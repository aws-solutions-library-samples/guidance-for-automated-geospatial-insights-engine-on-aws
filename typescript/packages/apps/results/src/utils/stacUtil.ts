/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { LambdaRequestContext } from '@agie/clients';
import { Catalog, CatalogDetails, polygonProcessingDetails, RegionResource, StacItem } from '@agie/events';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@smithy/util-stream';
import { bboxPolygon } from '@turf/turf';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import ow from 'ow';
import type { BaseLogger } from 'pino';
import { EngineMetadata } from '../events/models.js';
import { DefaultStacRecords } from './defaultStacRecords.js';

dayjs.extend(utc);

export class StacUtil {
	readonly context: LambdaRequestContext;

	private readonly regionIndexName = 'agie-region';
	private readonly polygonIndexName = 'agie-polygon';

	public constructor(readonly log: BaseLogger, readonly s3Client: S3Client, readonly bucketName: string) {
		this.log = log;
		this.s3Client = s3Client;
		this.bucketName = bucketName;

		// TODO must replace with valid credentials
		// Credentials used for calling the regions API
		this.context = {
			authorizer: {
				claims: {
					email: 'results',
					'custom:role': '/|||reader',
				},
			},
		};
	}

	public async constructStacItems(details: polygonProcessingDetails): Promise<StacItem> {
		this.log.debug(`StacUtil > constructStacItems > in ${JSON.stringify(details)}`);
		ow(details, ow.object.nonEmpty);
		ow(
			details,
			ow.object.exactShape({
				jobId: ow.string.nonEmpty,
				groupId: ow.string.nonEmpty,
				groupName: ow.string.nonEmpty,
				regionId: ow.string.nonEmpty,
				regionName: ow.string.nonEmpty,
				polygonId: ow.string.nonEmpty,
				polygonName: ow.string.nonEmpty,
				resultId: ow.string.nonEmpty,
				createdAt: ow.string.nonEmpty,
				startDateTime: ow.string.nonEmpty,
				endDateTime: ow.string.nonEmpty,
				engineOutputLocation: ow.string.nonEmpty,
			})
		);
		const stacItem = new DefaultStacRecords().defaultStacItem;

		const response = await this.s3Client.send(
			new GetObjectCommand({
				Bucket: this.bucketName,
				Key: details.engineOutputLocation,
			})
		);

		const engineMetadata: EngineMetadata = JSON.parse(await sdkStreamMixin(response.Body).transformToString());

		ow(
			engineMetadata,
			ow.object.exactShape({
				bounding_box: ow.array.nonEmpty,
				geometry: ow.object.nonEmpty,
				assets: ow.object.nonEmpty,
				extensions: ow.optional.object,
				links: ow.array.nonEmpty,
				properties: ow.object.nonEmpty,
			})
		);

		// const date = new Date(details.createdAt);
		const date = dayjs(details.createdAt).format();
		const utcDate = date.split('T')[0];
		const utcTime = date.split('T')[1].split('+')[0];

		// Update stac item id
		stacItem.id = `${details.resultId}_${details.polygonId}`;

		// set the collection
		stacItem.collection = this.polygonIndexName;

		// set the bbox
		stacItem.bbox = engineMetadata.bounding_box;

		// set the geometry currently we are only accepting polygons
		stacItem.geometry = engineMetadata.geometry;

		// Include the Sentinal link supplied via the engine
		// Append with additional links
		stacItem.links = [
			...engineMetadata.links,
			{
				rel: 'self',
				href: `./${stacItem.id}.json`,
				type: 'application/geo+json',
				title: details.polygonName,
			},
			{
				rel: 'collection',
				href: `./region_${details.regionId}.json`,
				type: 'application/json',
				title: details.regionName,
			},
			{
				rel: 'parent',
				href: `./region_${details.regionId}.json`,
				type: 'application/json',
				title: details.regionName,
			},
			{
				rel: 'collection',
				href: `./group_${details.groupId}.json`,
				type: 'application/json',
				title: details.groupName,
			},
			{
				rel: 'root',
				href: '../catalog.json',
				type: 'application/json',
				title: 'AGIE Catalog',
			},
		];

		// update extension
		stacItem.stac_extensions = engineMetadata.extensions;

		// Update the properties
		stacItem.properties = {
			datetime: details.createdAt,
			'agie:groupId': details.groupId,
			'agie:regionId': details.regionId,
			...engineMetadata.properties,
		};

		stacItem.assets = engineMetadata.assets;

		this.log.debug(`StacUtil > constructStacItems > exit ${JSON.stringify(stacItem)}`);
		return stacItem;
	}

	public async constructCatalog(detail: CatalogDetails): Promise<Catalog> {
		this.log.debug(`StacUtil > constructCatalog > in ${JSON.stringify(detail)}`);

		// Validate catalog
		ow(detail, ow.object.nonEmpty);
		ow(
			detail,
			ow.object.exactShape({
				id: ow.string.nonEmpty,
				title: ow.string.nonEmpty,
				description: ow.string.nonEmpty,
			})
		);

		const catalog = new DefaultStacRecords().defaultCatalog;

		catalog.id = `catalog_${detail.id}`;
		catalog.title = detail.title;
		catalog.description = detail.description;

		// Update links
		catalog.links = [
			{
				rel: 'self',
				href: '../catalog.json',
				type: 'application/json',
				title: catalog.title,
			},
		];

		this.log.debug(`StacUtil > constructCatalog > exit ${JSON.stringify(catalog)}`);
		return catalog;
	}

	public async constructRegionStacItem(regionResource: RegionResource & { isActive: boolean }): Promise<StacItem> {
		this.log.debug(`StacUtil > constructRegionStacItem > in regionResource: ${JSON.stringify(regionResource)}`);
		// validation
		ow(regionResource, ow.object.nonEmpty);
		ow(regionResource.id, ow.string.nonEmpty);
		ow(regionResource.groupId, ow.string.nonEmpty);
		ow(regionResource.boundingBox, ow.array.nonEmpty);

		const stacItem = new DefaultStacRecords().defaultStacItem;
		const { id, groupId } = regionResource;
		stacItem.id = id;
		stacItem.collection = `agie-region`;
		stacItem.bbox = regionResource.boundingBox;
		// for region stac item the bbox and the polygon covers the same area
		stacItem.geometry = bboxPolygon(regionResource.boundingBox).geometry;
		stacItem.properties = {
			datetime: regionResource.createdAt,
			createdAt: regionResource.createdAt,
			updatedAt: regionResource.updatedAt,
			'agie:isActive': regionResource.isActive,
			'agie:processedOnNewScene': regionResource.processingConfig.mode === 'onNewScene',
			'agie:groupId': groupId,
		};
		return stacItem;
	}
}

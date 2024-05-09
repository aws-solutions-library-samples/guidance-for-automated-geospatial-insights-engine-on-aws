import { LambdaRequestContext, RegionsClient } from '@arcade/clients';
import { Collection, GroupDetails, polygonProcessingDetails, RegionDetails, StacItem } from '@arcade/events';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import type { BaseLogger } from 'pino';
import { DefaultStacRecords } from './defaultStacRecords.js';
import { EngineMetadata } from "../events/models.js";
import ow from 'ow';

dayjs.extend(utc);

export class StacUtil {
	readonly context: LambdaRequestContext;

	public constructor(readonly log: BaseLogger, readonly s3Client: S3Client, readonly bucketName: string, readonly regionsClient: RegionsClient) {
		this.log = log;
		this.s3Client = s3Client;
		this.bucketName = bucketName;
		this.regionsClient = regionsClient;

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
				regionId: ow.string.nonEmpty,
				polygonId: ow.string.nonEmpty,
				resultId: ow.string.nonEmpty,
				createdAt: ow.string.nonEmpty,
				scheduleDateTime: ow.string.nonEmpty,
				engineOutputLocation: ow.string.nonEmpty
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

		const [group, region, polygon] = await Promise.all([
			// get Group Collection
			this.regionsClient.getGroupById(details.groupId, this.context),
			// get Region Collection
			this.regionsClient.getRegionById(details.regionId, this.context),
			//  Get Polygon Collection
			this.regionsClient.getPolygonById(details.polygonId, this.context),
		]);

		// Update stac item id
		stacItem.id = `${details.resultId}_${polygon.id}`;

		// set the collection
		stacItem.collection = `region_${region.id}`;

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
				title: polygon.name,
			},
			{
				rel: 'collection',
				href: `./region_${region.id}.json`,
				type: 'application/json',
				title: region.name,
			},
			{
				rel: 'parent',
				href: `./region_${region.id}.json`,
				type: 'application/json',
				title: region.name,
			},
			{
				rel: 'collection',
				href: `./group_${group.id}.json`,
				type: 'application/json',
				title: group.name,
			},
			{
				rel: 'root',
				href: '../catalog.json',
				type: 'application/json',
				title: 'ARCADE Catalog',
			},
		];

		// update extensiona
		stacItem.stac_extensions = engineMetadata.extensions;

		// Update the properties
		stacItem.properties = {
			datetime: details.createdAt,
			...engineMetadata.properties,
		};

		stacItem.assets = engineMetadata.assets;

		this.log.debug(`StacUtil > constructStacItems > exit ${JSON.stringify(stacItem)}`);
		return stacItem;
	}

	public async constructGroupCollection(groupDetail: GroupDetails): Promise<Collection> {
		this.log.debug(`StacUtil > constructGroupCollection > in ${JSON.stringify(groupDetail)}`);
		// validation
		ow(groupDetail, ow.object.nonEmpty);
		ow(groupDetail.groupId, ow.string.nonEmpty);
		ow(groupDetail.extent, ow.object.nonEmpty);
		ow(groupDetail.links, ow.object.nonEmpty);

		const collection = new DefaultStacRecords().defaultCollection;
		const group = await this.regionsClient.getGroupById(groupDetail.groupId, this.context);

		collection.id = `group_${group.id}`;
		collection.title = group.name;
		collection.description = group.name;
		collection.extent = groupDetail.extent;

		// Update links
		collection.links = [
			...groupDetail.links,
			{
				rel: 'self',
				href: `./group_${group.id}.json`,
				type: 'application/geo+json',
				title: group.name,
			},
			{
				rel: 'parent',
				href: '../catalog.json',
				type: 'application/json',
				title: 'ARCADE Catalog',
			},
			{
				rel: 'root',
				href: '../catalog.json',
				type: 'application/json',
				title: 'ARCADE Catalog',
			},
		];

		this.log.debug(`StacUtil > constructGroupCollection > exit ${JSON.stringify(collection)}`);
		return collection;
	}

	public async constructRegionCollection(regionDetail: RegionDetails): Promise<Collection> {
		this.log.debug(`StacUtil > constructRegionCollection > in ${JSON.stringify(regionDetail)}`);
		// validation
		ow(regionDetail, ow.object.nonEmpty);
		ow(regionDetail.regionId, ow.string.nonEmpty);
		ow(regionDetail.groupId, ow.string.nonEmpty);
		ow(regionDetail.extent, ow.object.nonEmpty);
		ow(regionDetail.links, ow.object.nonEmpty);

		const collection = new DefaultStacRecords().defaultCollection;
		const [group, region] = await Promise.all([
			// get Group Collection
			this.regionsClient.getGroupById(regionDetail.groupId, this.context),
			// get Region Collection
			this.regionsClient.getRegionById(regionDetail.regionId, this.context),
		]);

		collection.id = `region${region.id}`;
		collection.title = region.name;
		collection.description = region.name;
		collection.extent = regionDetail.extent;

		// Update links
		collection.links = [
			...regionDetail.links,
			{
				rel: 'self',
				href: `./region_${region.id}.json`,
				type: 'application/geo+json',
				title: region.name,
			},
			{
				rel: 'parent',
				href: `./group_${group.id}.json`,
				type: 'application/geo+json',
				title: group.name,
			},
			{
				rel: 'root',
				href: '../catalog.json',
				type: 'application/json',
				title: 'ARCADE Catalog',
			},
		];

		this.log.debug(`StacUtil > constructGroupCollection > exit ${JSON.stringify(collection)}`);
		return collection;
	}
}

import { LambdaRequestContext, RegionsClient } from '@arcade/clients';
import { Collection, GroupDetails, PipelineMetadataDetails, RegionDetails, StacItem } from '@arcade/events';
import { validateNotEmpty } from '@arcade/validators';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import dayjs from 'dayjs';
import utc from 'dayjs-plugin-utc';
import { EngineMetadata } from 'events/models.js';
import type { BaseLogger } from 'pino';
import { DefaultStacRecords } from './defaultStacRecords.js';
dayjs.extend(utc);

export class StacUtil {
	private readonly log: BaseLogger;
	private s3Client: S3Client;
	private readonly bucketName: string;
	private regionsClient: RegionsClient;
	private context: LambdaRequestContext;

	public constructor(log: BaseLogger, s3Client: S3Client, bucketName: string, regionsClient: RegionsClient) {
		this.log = log;
		this.s3Client = s3Client;
		this.bucketName = bucketName;
		this.regionsClient = regionsClient;

		// TODO must replace with valid credentials
		// Credentials used for calling the regions API
		this.context = {
			authorizer: {
				claims: {
					identities: JSON.stringify({
						userId: 'results',
					}),
					email: 'results',
					'cognito:groups': '/|||reader',
				},
			},
		};
	}

	public async constructStacItems(pipelineMetadata: PipelineMetadataDetails): Promise<StacItem> {
		this.log.debug(`StacUtil > constructStacItems > in ${JSON.stringify(pipelineMetadata)}`);

		// Validate pipelineMetadata
		validateNotEmpty(pipelineMetadata, 'event.detail');
		validateNotEmpty(pipelineMetadata.executionId, 'pipelineMetadata.executionId');
		validateNotEmpty(pipelineMetadata.groupId, 'pipelineMetadata.groupId');
		validateNotEmpty(pipelineMetadata.regionId, 'pipelineMetadata.regionId');
		validateNotEmpty(pipelineMetadata.zoneId, 'pipelineMetadata.zoneId');
		validateNotEmpty(pipelineMetadata.stateId, 'pipelineMetadata.stateId');
		validateNotEmpty(pipelineMetadata.engineOutPutLocation, 'pipelineMetadata.engineOutPutLocation');

		const stacItem = new DefaultStacRecords().defaultStacItem;

		const response = await this.s3Client.send(
			new GetObjectCommand({
				Bucket: this.bucketName,
				Key: pipelineMetadata.engineOutPutLocation,
			})
		);

		const engineMetadata: EngineMetadata = JSON.parse(await sdkStreamMixin(response.Body).transformToString());

		//Validate engineMetaData
		validateNotEmpty(engineMetadata, 'engineMetadata');
		validateNotEmpty(engineMetadata.bounding_box, 'engineMetadata.bounding_box');
		validateNotEmpty(engineMetadata.geometry, 'engineMetadata.geometry');
		validateNotEmpty(engineMetadata.assets, 'engineMetadata.assets');
		validateNotEmpty(engineMetadata.extensions, 'engineMetadata.extensions');
		validateNotEmpty(engineMetadata.geometry, 'engineMetadata.geometry');
		validateNotEmpty(engineMetadata.links, 'engineMetadata.links');
		validateNotEmpty(engineMetadata.properties, 'engineMetadata.properties');

		// const date = new Date(pipelineMetadata.createdAt);
		const date = dayjs(pipelineMetadata.createdAt).format();
		const utcDate = date.split('T')[0];
		const utcTime = date.split('T')[1].split('+')[0];

		const [group, region, zone] = await Promise.all([
			// get Group Collection
			this.regionsClient.getGroupById(pipelineMetadata.groupId, this.context),
			// get Region Collection
			this.regionsClient.getRegionById(pipelineMetadata.regionId, this.context),
			//  Get Zone Collection
			this.regionsClient.getZoneById(pipelineMetadata.zoneId, this.context),
		]);

		// Update stac item id
		stacItem.id = `${zone.id}_${utcDate}_${utcTime}`;

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
				title: zone.name,
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
			datetime: pipelineMetadata.createdAt,
			...engineMetadata.properties,
		};

		stacItem.assets = engineMetadata.assets;

		this.log.debug(`StacUtil > constructStacItems > exit ${JSON.stringify(stacItem)}`);
		return stacItem;
	}

	public async constructGroupCollection(groupDetail: GroupDetails): Promise<Collection> {
		this.log.debug(`StacUtil > constructGroupCollection > in ${JSON.stringify(groupDetail)}`);

		// Validate pipelineMetadata
		validateNotEmpty(groupDetail, 'event.detail');
		validateNotEmpty(groupDetail.groupId, 'event.detail.groupId');
		validateNotEmpty(groupDetail.extent, 'event.detail.extent');
		validateNotEmpty(groupDetail.links, 'event.detail.links');

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

		// Validate pipelineMetadata
		validateNotEmpty(regionDetail, 'event.detail');
		validateNotEmpty(regionDetail.regionId, 'event.detail.regionId');
		validateNotEmpty(regionDetail.groupId, 'event.detail.groupId');
		validateNotEmpty(regionDetail.extent, 'event.detail.extent');
		validateNotEmpty(regionDetail.links, 'event.detail.links');

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

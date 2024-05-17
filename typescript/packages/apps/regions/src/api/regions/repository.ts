import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import {
	DynamoDBDocumentClient,
	TransactWriteCommandInput,
	UpdateCommand,
	UpdateCommandInput
} from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { createDelimitedAttribute } from '../../common/ddbAttributes.util.js';
import { PkType } from '../../common/pkTypes.js';
import { Tags } from '../../common/schemas.js';
import { CommonRepository, DynamoDBItems } from '../repository.common.js';
import { Region, UpdateAggregatedPolygonsParameter } from './schemas.js';

export class RegionRepository {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly dc: DynamoDBDocumentClient,
		readonly tableName: string,
		readonly dynamoDbUtils: DynamoDbUtils,
		readonly commonRepository: CommonRepository
	) {}

	public async create(region: Region): Promise<void> {
		this.log.debug(`RegionRepository> create> c:${JSON.stringify(region)}`);

		// the main item
		const transaction = this.prepareRegionTransactionWrite(region);

		// add any tags
		const regionDbId = createDelimitedAttribute(PkType.Region, region.id);
		this.commonRepository.addTags(region.tags, regionDbId, transaction);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`RegionRepository> create> exit>`);
	}

	public async updateAggregatedAttribute(id: string, aggregatedAttribute: UpdateAggregatedPolygonsParameter): Promise<Region> {
		this.log.debug(`RegionRepository> updateAggregatedAttribute> id: ${id}, aggregatedAttribute: ${JSON.stringify(aggregatedAttribute)}`);
		const regionDbId = createDelimitedAttribute(PkType.Region, id);
		const params: UpdateCommandInput = {
			UpdateExpression: "SET totalArea = totalArea + :totalAreaDelta, totalPolygons = totalPolygons + :totalPolygonsDelta",
			ExpressionAttributeValues: {
				':totalAreaDelta': aggregatedAttribute.totalAreaDelta,
				':totalPolygonsDelta': aggregatedAttribute.totalPolygonsDelta
			},
			Key: {
				pk: regionDbId,
				sk: regionDbId
			},
			TableName: this.tableName,
			ReturnValues: "ALL_NEW"
		}
		const updateResponse = await this.dc.send(new UpdateCommand(params));
		const region = this.assembleRegion([updateResponse.Attributes])
		this.log.debug(`RegionRepository> updateAggregatedAttribute> region: ${JSON.stringify(region)}`);
		return region;
	}

	public async update(r: Region, tagsToAdd: Tags, tagsToDelete: string[]): Promise<void> {
		this.log.debug(`RegionRepository> update> r:${JSON.stringify(r)}, tagsToAdd:${JSON.stringify(tagsToAdd)}, tagsToDelete:${JSON.stringify(tagsToDelete)}`);

		// the main item
		const transaction = this.prepareRegionTransactionWrite(r);

		// add/delete tag items
		transaction.TransactItems.push(...this.commonRepository.prepareTagTransactionWrite(r.id, PkType.Region, tagsToAdd, tagsToDelete).TransactItems);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`RegionRepository> update> exit>`);
	}

	private prepareRegionTransactionWrite(r: Region): TransactWriteCommandInput {
		const regionDbId = createDelimitedAttribute(PkType.Region, r.id);
		const command: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: regionDbId,
							sk: regionDbId,
							type: PkType.Region,
							id: r.id,
							name: r.name,
							groupId: r.groupId,
							processingConfig: r.processingConfig,
							attributes: r.attributes,
							createdAt: r.createdAt,
							createdBy: r.createdBy,
							updatedAt: r.updatedAt,
							updatedBy: r.updatedBy,
							totalArea: r.totalArea,
							totalPolygons: r.totalPolygons
						},
					},
				},
			],
		};
		return command;
	}

	public async get(id: string): Promise<Region | undefined> {
		this.log.debug(`RegionRepository> get> id:${JSON.stringify(id)}`);

		const items = await this.commonRepository.getItems(PkType.Region, id);
		const region = this.assembleRegion(items);
		this.log.debug(`RegionRepository> get> exit:${JSON.stringify(region)}`);
		return region;
	}

	public async delete(id: string): Promise<void> {
		this.log.debug(`RegionRepository> delete> id:${id}`);

		const transaction = await this.commonRepository.prepareDeleteItemsTransaction(PkType.Region, id);
		await this.commonRepository.executeTransaction(transaction);
		this.log.debug(`GroupRepository> delete> exit>`);
	}

	public async listByIds(regionIds: string[]): Promise<Region[]> {
		this.log.debug(`RegionRepository> listByIds> regionIds:${JSON.stringify(regionIds)}`);
		const items = await this.commonRepository.listItemsByIds(PkType.Region, regionIds);
		const regions = this.assembleRegions(items);
		this.log.debug(`RegionRepository> listByIds> exit:${JSON.stringify([regions])}`);
		return regions;
	}

	private assembleRegions(items: DynamoDBItems): Region[] {
		this.log.debug(`RegionRepository> assembleRegions> in> items:${JSON.stringify(items)}`);
		const regions: Region[] = [];
		const regionIds = new Set(items.map((i) => i.pk));
		for (const regionId of regionIds) {
			const regionItems = items.filter((i) => i.pk === regionId);
			const region = this.assembleRegion(regionItems);
			if (region) {
				regions.push(region);
			}
		}
		return regions;
	}

	private assembleRegion(items: DynamoDBItems): Region {
		this.log.debug(`RegionRepository> assemble> in> items:${JSON.stringify(items)}`);
		if ((items?.length ?? 0) === 0) {
			return undefined;
		}

		// build the main region resource
		let region: Region;
		const regionItem = items.filter((i) => i.type === PkType.Region)[0];
		if (regionItem) {
			region = {
				id: regionItem.id,
				groupId: regionItem.groupId,
				name: regionItem.name,
				totalArea: regionItem.totalArea,
				totalPolygons: regionItem.totalPolygons,
				attributes: regionItem.attributes,
				tags: {},
				processingConfig: regionItem.processingConfig,
				createdBy: regionItem.createdBy,
				createdAt: regionItem.createdAt,
				updatedBy: regionItem.updatedBy,
				updatedAt: regionItem.updatedAt,
			};
			this.commonRepository.assembleTags(items, region.tags);
		}

		this.log.debug(`RegionRepository> assemble> exit:${JSON.stringify(region)}`);
		return region;
	}
}

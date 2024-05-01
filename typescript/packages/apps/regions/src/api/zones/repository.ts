import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { createDelimitedAttribute } from '../../common/ddbAttributes.util.js';
import { PkType } from '../../common/pkTypes.js';
import { Tags } from '../../common/schemas.js';
import { CommonRepository, DynamoDBItems } from '../repository.common.js';
import { StateRepository } from '../states/repository.js';
import { Zone } from './schemas.js';

export class ZoneRepository {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly dc: DynamoDBDocumentClient,
		readonly tableName: string,
		readonly dynamoDbUtils: DynamoDbUtils,
		readonly commonRepository: CommonRepository,
		readonly stateRepository: StateRepository
	) {}

	public async create(zone: Zone): Promise<void> {
		this.log.debug(`ZoneRepository> create> c:${JSON.stringify(zone)}`);

		// the main item
		const transaction = this.prepareZoneTransactionWrite(zone);

		// add any tags
		const zoneDbId = createDelimitedAttribute(PkType.Zone, zone.id);
		this.commonRepository.addTags(zone.tags, zoneDbId, transaction);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`ZoneRepository> create> exit>`);
	}

	public async update(z: Zone, tagsToAdd: Tags, tagsToDelete: string[]): Promise<void> {
		this.log.debug(`ZoneRepository> update> z:${JSON.stringify(z)}, tagsToAdd:${JSON.stringify(tagsToAdd)}, tagsToDelete:${JSON.stringify(tagsToDelete)}`);

		// the main item
		const transaction = this.prepareZoneTransactionWrite(z);

		// add/delete tag items
		transaction.TransactItems.push(...this.commonRepository.prepareTagTransactionWrite(z.id, PkType.Zone, tagsToAdd, tagsToDelete).TransactItems);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`ZoneRepository> update> exit>`);
	}

	private prepareZoneTransactionWrite(z: Zone): TransactWriteCommandInput {
		const zoneDbId = createDelimitedAttribute(PkType.Zone, z.id);
		const command: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: zoneDbId,
							sk: zoneDbId,
							type: PkType.Zone,
							id: z.id,
							name: z.name,
							regionId: z.regionId,
							boundary: z.boundary,
							exclusions: z.exclusions,
							area: z.area,
							attributes: z.attributes,
							scheduleExpression: z.scheduleExpression,
							scheduleExpressionTimezone: z.scheduleExpressionTimezone,
							createdAt: z.createdAt,
							createdBy: z.createdBy,
							updatedAt: z.updatedAt,
							updatedBy: z.updatedBy,
						},
					},
				},
			],
		};
		return command;
	}

	public async get(id: string): Promise<Zone | undefined> {
		this.log.debug(`ZoneRepository> get> id:${JSON.stringify(id)}`);

		const items = await this.commonRepository.getItems(PkType.Zone, id);
		const zone = await this.assembleZone(items, true);
		this.log.debug(`ZoneRepository> get> exit:${JSON.stringify(zone)}`);
		return zone;
	}

	public async delete(id: string): Promise<void> {
		this.log.debug(`ZoneRepository> delete> id:${id}`);
		const transaction = await this.commonRepository.prepareDeleteItemsTransaction(PkType.Zone, id);
		await this.commonRepository.executeTransaction(transaction);
		this.log.debug(`GroupRepository> delete> exit>`);
	}

	public async listByIds(zoneIds: string[], includeLatestState: boolean): Promise<Zone[]> {
		this.log.debug(`ZoneRepository> listByIds> zoneIds:${JSON.stringify(zoneIds)}, includeLatestState:${includeLatestState}`);
		const items = await this.commonRepository.listItemsByIds(PkType.Zone, zoneIds);
		const zones = await this.assembleZones(items, includeLatestState);
		this.log.debug(`ZoneRepository> listByIds> exit:${JSON.stringify([zones])}`);
		return zones;
	}

	private async assembleZones(items: DynamoDBItems, includeLatestState: boolean): Promise<Zone[]> {
		this.log.debug(`ZoneRepository> assembleZones> in> items:${JSON.stringify(items)}, includeLatestState:${includeLatestState}`);
		const zones: Zone[] = [];
		const zoneIds = new Set(items.map((i) => i.pk));
		for (const zoneId of zoneIds) {
			const zoneItems = items.filter((i) => i.pk === zoneId);
			const zone = await this.assembleZone(zoneItems, includeLatestState);
			if (zone) {
				zones.push(zone);
			}
		}
		return zones;
	}

	private async assembleZone(items: DynamoDBItems, includeLatestState: boolean): Promise<Zone> {
		this.log.debug(`ZoneRepository> assemble> in> items:${JSON.stringify(items)}, includeLatestState:${includeLatestState}`);
		if ((items?.length ?? 0) === 0) {
			return undefined;
		}

		// build the main zone resource
		let zone: Zone;
		const zoneItem = items.filter((i) => i.type === PkType.Zone)[0];
		if (zoneItem) {
			zone = {
				id: zoneItem.id,
				regionId: zoneItem.regionId,
				name: zoneItem.name,
				boundary: zoneItem.boundary,
				exclusions: zoneItem.exclusions,
				area: zoneItem.area,
				attributes: zoneItem.attributes,
				tags: {},
				scheduleExpressionTimezone: zoneItem.scheduleExpressionTimezone,
				scheduleExpression: zoneItem.scheduleExpression,
				createdBy: zoneItem.createdBy,
				createdAt: zoneItem.createdAt,
				updatedBy: zoneItem.updatedBy,
				updatedAt: zoneItem.updatedAt,
			};

			// assemble latest state
			if (includeLatestState === true) {
				const latestStateItem = items.filter((i) => i.type === PkType.LatestState)?.[0];
				if (latestStateItem) {
					const stateId = latestStateItem.id;
					zone.state = await this.stateRepository.get(stateId);
				}
			}

			this.commonRepository.assembleTags(items, zone.tags);
		}

		this.log.debug(`ZoneRepository> assemble> exit:${JSON.stringify(zone)}`);
		return zone;
	}
}

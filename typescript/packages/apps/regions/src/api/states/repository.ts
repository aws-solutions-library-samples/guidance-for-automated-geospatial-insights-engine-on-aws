import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import { DynamoDBDocumentClient, ExecuteStatementCommand, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { RESERVED_PREFIX, createDelimitedAttribute } from '../../common/ddbAttributes.util.js';
import { PkType } from '../../common/pkTypes.js';
import { Tags } from '../../common/schemas.js';
import { CommonRepository, DynamoDBItems } from '../repository.common.js';
import { State } from './schemas.js';

export class StateRepository {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly dc: DynamoDBDocumentClient,
		readonly tableName: string,
		readonly dynamoDbUtils: DynamoDbUtils,
		readonly commonRepository: CommonRepository
	) {}

	public async create(state: State, existingLatestState: State): Promise<void> {
		this.log.debug(`StateRepository> create> state:${JSON.stringify(state)}, existingLatestState:${JSON.stringify(existingLatestState)}`);

		// the main item
		const transaction = this.prepareStateTransactionWrite(state);

		// if the state is the new latest state, update accordingly
		if (existingLatestState === undefined || existingLatestState.timestamp <= state.timestamp) {
			this.prepareLatestStateTransactionWrite(transaction, state.zoneId, state.id, existingLatestState?.id);
		}

		// add any tags
		const stateDbId = createDelimitedAttribute(PkType.State, state.id);
		this.commonRepository.addTags(state.tags, stateDbId, transaction);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`StateRepository> create> exit>`);
	}

	public async update(s: State, tagsToAdd: Tags, tagsToDelete: string[]): Promise<void> {
		this.log.debug(`StateRepository> update> s:${JSON.stringify(s)}, tagsToAdd:${JSON.stringify(tagsToAdd)}, tagsToDelete:${JSON.stringify(tagsToDelete)}`);

		// the main item
		const transaction = this.prepareStateTransactionWrite(s);

		// add/delete tag items
		transaction.TransactItems.push(...this.commonRepository.prepareTagTransactionWrite(s.id, PkType.State, tagsToAdd, tagsToDelete).TransactItems);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`StateRepository> update> exit>`);
	}

	private prepareStateTransactionWrite(s: State): TransactWriteCommandInput {
		this.log.debug(`StateRepository> prepareStateTransactionWrite> in> s:${JSON.stringify(s)}`);
		const stateDbId = createDelimitedAttribute(PkType.State, s.id);
		const command: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: stateDbId,
							sk: stateDbId,
							type: PkType.State,
							siKey2: createDelimitedAttribute(PkType.Zone, s.zoneId),
							siKey3: createDelimitedAttribute(PkType.Timestamp, s.timestamp),
							id: s.id,
							zoneId: s.zoneId,
							regionId: s.regionId,
							groupId: s.groupId,
							timestamp: s.timestamp,
							attributes: s.attributes,
							createdAt: s.createdAt,
							createdBy: s.createdBy,
							updatedAt: s.updatedAt,
							updatedBy: s.updatedBy,
						},
					},
				},
			],
		};
		this.log.debug(`StateRepository> prepareStateTransactionWrite> exit:${JSON.stringify(command)}`);
		return command;
	}

	private prepareLatestStateTransactionWrite(transaction: TransactWriteCommandInput, zoneId: string, newLatestStateId: string, existingLatestStateId?: string): void {
		this.log.debug(
			`StateRepository> prepareLatestStateTransactionWrite> in> transaction:${JSON.stringify(
				transaction
			)}, zoneId:${zoneId}, newLatestStateId:${newLatestStateId}, existingLatestStateId:${existingLatestStateId}`
		);
		const latestTagKey = `${RESERVED_PREFIX}isLatest`;

		if (existingLatestStateId) {
			// remove the previous latest state stored as a tag (tags are used for listing latest states)
			// but first we need to ensure that we don't already have a delete operation in our transaction for this item
			const tagsTransaction = this.commonRepository.prepareTagTransactionWrite(existingLatestStateId, PkType.State, {}, [latestTagKey]).TransactItems;
			tagsTransaction.forEach((t1) => {
				if (!transaction.TransactItems.find((t2) => t1.Delete.Key['pk'] === t2.Delete?.Key['pk'] && t1.Delete.Key['sk'] === t2.Delete?.Key['sk'])) {
					transaction.TransactItems.push(t1);
				}
			});
		}

		const zoneDbId = createDelimitedAttribute(PkType.Zone, zoneId);
		const latestStateDbId = createDelimitedAttribute(PkType.State, `${RESERVED_PREFIX}latest`);

		// add new latest state stored as a tag (used for listing latest states)
		if (newLatestStateId) {
			const latestTag: Tags = {
				[latestTagKey]: 'true',
			};
			transaction.TransactItems.push(...this.commonRepository.prepareTagTransactionWrite(newLatestStateId, PkType.State, latestTag, []).TransactItems);
			// add the zone to state link (used for quick lookup of latest state when assembling zones)
			transaction.TransactItems.push({
				Put: {
					TableName: this.tableName,
					Item: {
						pk: zoneDbId,
						sk: latestStateDbId,
						type: PkType.LatestState,
						id: newLatestStateId,
					},
				},
			});
		}

		// if there's no new or existing latest state to save, such as first state being deleted, remove the existing zone to state link
		if (!newLatestStateId && !existingLatestStateId) {
			transaction.TransactItems.push({
				Delete: {
					TableName: this.tableName,
					Key: {
						pk: zoneDbId,
						sk: latestStateDbId,
					},
				},
			});
		}
		this.log.debug(`StateRepository> prepareLatestStateTransactionWrite> exit> transaction:${JSON.stringify(transaction)}`);
	}

	public async get(id: string): Promise<State | undefined> {
		this.log.debug(`StateRepository> get> id:${JSON.stringify(id)}`);
		const items = await this.commonRepository.getItems(PkType.State, id);
		const state = this.assembleState(items);
		this.log.debug(`StateRepository> get> exit:${JSON.stringify(state)}`);
		return state;
	}

	public async delete(state: State, existingLatestState: State): Promise<void> {
		this.log.debug(`StateRepository> delete> state.id:${state.id}, existingLatestStat.id:${existingLatestState?.id}`);

		// prepare to delete all state items (where pk = stateDbId)
		const transaction = await this.commonRepository.prepareDeleteItemsTransaction(PkType.State, state.id);

		// if the state being deleted is currently the latest state for a zone, we need to revert back to the previous latest state
		if (existingLatestState?.id === state.id) {
			// we are deleting the latest, therefore find previous latest state
			const statement = `SELECT * FROM "${this.tableName}"."siKey2-siKey3-index" WHERE "siKey2" = ? ORDER BY "siKey3" desc`; // `siKey3` is `timestamp`
			const response = await this.dc.send(
				new ExecuteStatementCommand({
					Statement: statement,
					Parameters: [createDelimitedAttribute(PkType.Zone, state.zoneId)],
					Limit: 2, // only need to return top 2 which should be current latest (if exists), and previous latest (if exists)
				})
			);
			const items = response.Items;
			if (existingLatestState?.id === items[0]?.id) {
				// remove current latest state from the result set so we can grab the previous
				items.shift();
			}
			const previousLatestStateId = items[0]?.id;

			// unmark current latest, and mark previous latest
			this.prepareLatestStateTransactionWrite(transaction, state.zoneId, previousLatestStateId, state.id);
		}

		await this.commonRepository.executeTransaction(transaction);
		this.log.debug(`GroupRepository> delete> exit>`);
	}

	public async listByIds(stateIds: string[]): Promise<State[]> {
		this.log.debug(`StateRepository> listByIds> stateIds:${JSON.stringify(stateIds)}`);
		const items = await this.commonRepository.listItemsByIds(PkType.State, stateIds);
		const states = this.assembleStates(items);
		this.log.debug(`StateRepository> listByIds> exit:${JSON.stringify([states])}`);
		return states;
	}

	private assembleStates(items: DynamoDBItems): State[] {
		this.log.debug(`StateRepository> assembleStates> in> items:${JSON.stringify(items)}`);
		const states: State[] = [];
		const stateIds = new Set(items.map((i) => i.pk));
		for (const stateId of stateIds) {
			const stateItems = items.filter((i) => i.pk === stateId);
			const state = this.assembleState(stateItems);
			if (state) {
				states.push(state);
			}
		}
		return states;
	}

	private assembleState(items: DynamoDBItems): State {
		this.log.debug(`StateRepository> assembleState> in> items:${JSON.stringify(items)}`);
		if ((items?.length ?? 0) === 0) {
			return undefined;
		}

		// build the main state resource
		let state: State;
		const stateItem = items.filter((i) => i.type === PkType.State)[0];
		if (stateItem) {
			state = {
				id: stateItem.id,
				zoneId: stateItem.zoneId,
				regionId: stateItem.regionId,
				groupId: stateItem.groupId,
				timestamp: stateItem.timestamp,
				attributes: stateItem.attributes,
				tags: {},
				createdBy: stateItem.createdBy,
				createdAt: stateItem.createdAt,
				updatedBy: stateItem.updatedBy,
				updatedAt: stateItem.updatedAt,
			};

			this.commonRepository.assembleTags(items, state.tags);
		}

		this.log.debug(`StateRepository> assembleState> exit:${JSON.stringify(state)}`);
		return state;
	}
}

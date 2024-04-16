import { createDelimitedAttribute, createDelimitedAttributePrefix, expandDelimitedAttribute } from '@arcade/dynamodb-utils';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
	DynamoDBDocumentClient,
	ExecuteStatementCommand,
	NativeAttributeValue,
	QueryCommand,
	QueryCommandInput,
	TransactWriteCommand,
	TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { BaseLogger } from 'pino';
import { RESERVED_PREFIX } from '../common/ddbAttributes.util.js';
import { DatabaseTransactionError, TransactionCancellationReason } from '../common/errors.js';
import { PkType } from '../common/pkTypes.js';
import { Tags } from '../common/schemas.js';
import { ListPaginationOptions } from './service.common.js';

export interface TablePartitionKey {
	pk: string;
	sk: string;
}
export interface GSI1PartitionKey {
	pk: string;
	sk: string;
	siKey1: string;
}
export interface GSI2PartitionKey {
	pk: string;
	sk: string;
	type: string;
}
export interface GSI3PartitionKey {
	pk: string;
	sk: string;
	siKey2: string;
	siKey3: string;
}

export class CommonRepository {
	public constructor(readonly log: BaseLogger, readonly dc: DynamoDBDocumentClient, readonly tableName: string) {}

	public addTags(tags: Tags, owningResourceDbId: string, transaction: TransactWriteCommandInput) {
		Object.entries(tags).forEach(([k, v]) => {
			transaction.TransactItems.push({
				Put: {
					TableName: this.tableName,
					Item: {
						pk: owningResourceDbId,
						sk: createDelimitedAttribute(PkType.TagKey, k),
						siKey1: createDelimitedAttribute(PkType.TagKey, k, PkType.TagValue, v),
						type: PkType.TagKey,
						key: k,
						value: v,
					},
				},
			});
		});
	}

	public async getItems(resourcePrefix: PkType, id: string): Promise<DynamoDBItems> {
		this.log.debug(`CommonRepository> getItems> resourcePrefix:${resourcePrefix}, id:${id}`);

		const dbId = createDelimitedAttribute(resourcePrefix, id);

		let nextToken: string;
		let keepGoing = true;
		const items: Record<string, NativeAttributeValue>[] = [];
		const statement = `SELECT * FROM "${this.tableName}" WHERE "pk" = ?`;
		while (keepGoing) {
			const input = new ExecuteStatementCommand({
				Statement: statement,
				Parameters: [dbId],
				NextToken: nextToken,
				ConsistentRead: true,
			});
			this.log.debug(`CommonRepository> input>: ${JSON.stringify(input)}`);
			const query = await this.dc.send(input);
			this.log.debug(`CommonRepository> query>: ${JSON.stringify(query)}`);
			items.push(...query.Items);
			keepGoing = (nextToken = query.NextToken) !== undefined;
		}
		this.log.debug(`CommonRepository> getItems> exit:${JSON.stringify(items)}`);
		return items;
	}

	public async prepareDeleteItemsTransaction(resourcePrefix: PkType, id: ResourceId): Promise<TransactWriteCommandInput> {
		this.log.debug(`CommonRepository> prepareDeleteItemsTransaction> resourcePrefix:${resourcePrefix}, id:${id}`);

		// keys
		const dbId = createDelimitedAttribute(resourcePrefix, id);

		const dbIds: TablePartitionKey[] = [];
		let exclusiveStartKey: Record<string, any>;
		do {
			// list all items directly relating to the resource
			const params: QueryCommandInput = {
				TableName: this.tableName,
				KeyConditionExpression: `#hash=:hash`,
				ExpressionAttributeNames: {
					'#hash': 'pk',
				},
				ExpressionAttributeValues: {
					':hash': dbId,
				},
				ExclusiveStartKey: exclusiveStartKey,
			};
			this.log.trace(`CommonRepository> prepareDeleteItemsTransaction> params1:${JSON.stringify(params)}`);
			const data = await this.dc.send(new QueryCommand(params));
			this.log.trace(`CommonRepository> prepareDeleteItemsTransaction> data:${JSON.stringify(data)}`);
			if (data.Count > 0) {
				dbIds.push(...data.Items.map((i) => ({ pk: i['pk'], sk: i['sk'] })));
			}
			exclusiveStartKey = data.LastEvaluatedKey;
		} while (exclusiveStartKey !== undefined);
		this.log.debug(`CommonRepository> prepareDeleteItemsTransaction> dbIds:${JSON.stringify(dbIds)}`);

		// prepare the transaction to delete the resource related items
		const transaction: TransactWriteCommandInput = {
			TransactItems: dbIds.map((i) => ({
				Delete: {
					TableName: this.tableName,
					Key: {
						pk: i.pk,
						sk: i.sk,
					},
				},
			})),
		};

		// return to the caller in case there are extra resource specific items to add
		this.log.debug(`CommonRepository> prepareDeleteItemsTransaction> exit: ${JSON.stringify(transaction)}`);
		return transaction;
	}

	private isReservedTag(key: string): boolean {
		return key?.startsWith(RESERVED_PREFIX);
	}

	public prepareTagTransactionWrite(resourceId: ResourceId, keyPrefix: PkType, added: Tags = {}, removed: string[] = []): TransactWriteCommandInput {
		this.log.debug(
			`CommonRepository> prepareTagTransactionWrite> in> resourceId:${resourceId}, keyPrefix:${keyPrefix}, added:${JSON.stringify(added)}, removed:${JSON.stringify(removed)}`
		);

		const command: TransactWriteCommandInput = {
			TransactItems: [],
		};

		const pk = createDelimitedAttribute(keyPrefix, resourceId);

		// 1st add all the tags to add
		Object.entries(added).forEach(([k, v]) => {
			command.TransactItems.push({
				Put: {
					TableName: this.tableName,
					Item: {
						pk,
						sk: createDelimitedAttribute(PkType.TagKey, k),
						siKey1: createDelimitedAttribute(PkType.TagKey, k, PkType.TagValue, v),
						type: PkType.TagKey,
						// key: !this.isReservedTag(k) ? k : undefined,
						// value: !this.isReservedTag(k) ? v : undefined,
						key: k,
						value: v,
					},
				},
			});
		});

		// 2nd, add the tags to delete
		for (const k of removed) {
			const sk = createDelimitedAttribute(PkType.TagKey, k);
			command.TransactItems.push({
				Delete: {
					TableName: this.tableName,
					Key: {
						pk,
						sk,
					},
				},
			});
		}

		this.log.debug(`CommonRepository> prepareTagTransactionWrite> exit:${JSON.stringify(command)}`);
		return command;
	}

	public async executeTransaction(transaction: TransactWriteCommandInput): Promise<void> {
		this.log.debug(`CommonRepository> executeTransaction> transaction:${JSON.stringify(transaction)}`);
		if (transaction.TransactItems.length === 0) {
			this.log.warn('CommonRepository> executeTransaction> exit due to empty transaction');
			return;
		}
		return this.executeTransactionWithRetries(transaction, 2);
	}

	public async executeTransactionWithRetries(transaction: TransactWriteCommandInput, retriesRemaining: number): Promise<void> {
		this.log.debug(`CommonRepository> executeTransactionWithRetries> transaction:${JSON.stringify(transaction)}, retriesRemaining:${retriesRemaining}`);

		if (retriesRemaining <= 0) {
			this.log.debug(`CommonRepository> executeTransactionWithRetries> out of retries`);
			return;
		}

		try {
			const response = await this.dc.send(new TransactWriteCommand(transaction));
			this.log.debug(`CommonRepository> executeTransactionWithRetries> response:${JSON.stringify(response)}`);
		} catch (err) {
			if (err instanceof Error) {
				if (err.name === 'TransactionCanceledException') {
					this.log.error(`CommonRepository> executeTransactionWithRetries> err> ${JSON.stringify((err as TransactionCanceledException).CancellationReasons)}`);
					if (retriesRemaining > 1) {
						return this.executeTransactionWithRetries(transaction, retriesRemaining - 1);
					}
					throw new DatabaseTransactionError((err as TransactionCanceledException).CancellationReasons as TransactionCancellationReason[]);
				} else {
					this.log.error(err);
					throw err;
				}
			}
		}
	}

	public async listResourceIdsByTag(tagKey: string, tagValue: string, resourcePrefix: PkType, pagination?: ListPaginationOptions): Promise<[ResourceId[], ResourceId]> {
		this.log.debug(
			`CommonRepository> listResourceIdsByTag> in> tagKey:${tagKey}, tagValue:${tagValue}, resourcePrefix:${resourcePrefix}, pagination:${JSON.stringify(pagination)}`
		);

		// build the exclusive start key if pagination has been requested
		const siKey1 = createDelimitedAttribute(PkType.TagKey, tagKey, PkType.TagValue, tagValue);
		let exclusiveStartKey: GSI1PartitionKey;
		if (pagination?.token) {
			exclusiveStartKey = {
				pk: createDelimitedAttribute(resourcePrefix, pagination?.token),
				sk: createDelimitedAttribute(PkType.TagKey, tagKey),
				siKey1,
			};
		}

		let resourceIds: ResourceId[] = [];
		let nextToken: NextToken;
		let keepGoing = true;
		while (keepGoing) {
			const params: QueryCommandInput = {
				TableName: this.tableName,
				IndexName: 'siKey1-pk-index',
				KeyConditionExpression: `#hash=:hash AND begins_with(#sort,:sort)`,
				ExpressionAttributeNames: {
					'#hash': 'siKey1',
					'#sort': 'pk',
				},
				ExpressionAttributeValues: {
					':hash': siKey1,
					':sort': createDelimitedAttributePrefix(resourcePrefix),
				},
				ProjectionExpression: 'pk',
				ExclusiveStartKey: exclusiveStartKey,
				Limit: pagination?.count,
				ScanIndexForward: true,
			};

			this.log.trace(`CommonRepository> listResourceIdsByTag> params:${JSON.stringify(params)}`);
			const queryResponse = await this.dc.send(new QueryCommand(params));
			this.log.trace(`CommonRepository> listResourceIdsByTag> queryResponse:${JSON.stringify(queryResponse)}`);

			const results = queryResponse?.Items?.map((i) => expandDelimitedAttribute(i['pk'])[1]);
			resourceIds.push(...results);

			if (queryResponse.LastEvaluatedKey) {
				exclusiveStartKey = queryResponse.LastEvaluatedKey as GSI1PartitionKey;
				keepGoing = true;
			} else {
				keepGoing = false;
				exclusiveStartKey = undefined;
			}

			if (resourceIds.length >= pagination?.count) {
				const slicedResults = resourceIds.slice(0, pagination.count);
				const lastEvaluatedId = slicedResults[slicedResults.length - 1];
				return [slicedResults, lastEvaluatedId];
			}
		}

		if (resourceIds.length >= pagination?.count) {
			resourceIds = resourceIds.slice(0, pagination.count);
			nextToken = resourceIds[resourceIds.length - 1];
		}

		this.log.debug(`CommonRepository> listResourceIdsByTag> exit: result:${JSON.stringify([resourceIds, nextToken])}`);
		return [resourceIds, nextToken];
	}

	public async listResourceIds(resourcePrefix: PkType, pagination?: ListPaginationOptions): Promise<[ResourceId[], NextToken]> {
		this.log.debug(`commonRepository> listResourceIds> in> resourcePrefix:${resourcePrefix}, pagination:${JSON.stringify(pagination)}`);

		let resourceIds: ResourceId[] = [];
		const statement = `SELECT pk FROM "${this.tableName}"."type-sk-index" WHERE "type" = ? AND BEGINS_WITH("sk", ?)`;

		const response = await this.dc.send(
			new ExecuteStatementCommand({
				Statement: statement,
				Parameters: [resourcePrefix, createDelimitedAttributePrefix(resourcePrefix)],
				NextToken: pagination?.token,
				Limit: pagination?.count,
			})
		);
		const results = response?.Items?.map((i) => expandDelimitedAttribute(i.pk)[1]);
		resourceIds.push(...results);

		const nextToken = encodeURIComponent(response.NextToken);
		this.log.debug(`commonRepository> listResourceIds> exit: result:${JSON.stringify([resourceIds, nextToken])}`);
		return [resourceIds, nextToken];
	}

	public async listItemsByIds(resourcePrefix: PkType, resourceIds: ResourceId[]): Promise<DynamoDBItems> {
		this.log.debug(`CommonRepository> listItemsByIds> resourcePrefix:${resourcePrefix}, resourceIds:${JSON.stringify(resourceIds)}`);

		if ((resourceIds?.length ?? 0) === 0) {
			this.log.debug(`CommonRepository> listItemsByIds> early exit:[]`);
			return [];
		}

		const resourceDbIds = resourceIds.map((id) => `'${createDelimitedAttribute(resourcePrefix, id)}'`);

		let nextToken: NextToken;
		let keepGoing = true;
		const items: DynamoDBItems = [];
		const statement = `SELECT * FROM "${this.tableName}" WHERE "pk" IN (${resourceDbIds.join(',')})`;
		while (keepGoing) {
			const request = new ExecuteStatementCommand({
				Statement: statement,
				NextToken: nextToken,
				ConsistentRead: true,
			});
			this.log.trace(`CommonRepository> listItemsByIds> request:${JSON.stringify([request])}`);
			const response = await this.dc.send(request);
			this.log.trace(`CommonRepository> listItemsByIds> response:${JSON.stringify([response])}`);
			items.push(...response.Items);
			keepGoing = (nextToken = response.NextToken) !== undefined;
		}

		this.log.debug(`CommonRepository> listItemsByIds> exit:${JSON.stringify([items])}`);
		return items;
	}

	public assembleTags(items: DynamoDBItems, tags: Tags): void {
		const tagItems = items.filter((i) => i.type === PkType.TagKey && !i.sk.startsWith(createDelimitedAttribute(PkType.TagKey, RESERVED_PREFIX)));
		for (const tagItem of tagItems) {
			const tagKey = tagItem.key;
			const tagValue = tagItem.value;
			tags[tagKey] = tagValue;
		}
	}
}

export type ResourceId = string;
export type NextToken = string;
export type DynamoDBItems = Record<string, NativeAttributeValue>[];

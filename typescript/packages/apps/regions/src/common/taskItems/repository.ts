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

import type { FastifyBaseLogger } from 'fastify';
import {
	DynamoDBDocumentClient,
	GetCommand,
	GetCommandInput,
	QueryCommand,
	QueryCommandInput,
	TransactWriteCommand,
	TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

import type { TransactionCanceledException, TransactWriteItemsCommandInput } from '@aws-sdk/client-dynamodb';
import { TaskItemResource, TaskItemStatus } from "./schemas.js";
import {
	createDelimitedAttribute,
	createDelimitedAttributePrefix,
	DocumentDbClientItem,
	expandDelimitedAttribute
} from "../../common/ddbAttributes.util.js";
import { DatabaseTransactionError, NotFoundError, TransactionCancellationReason } from '../../common/errors.js';

export class TaskItemRepository {
	private readonly GSI2 = 'siKey2-pk-index';

	private readonly defaultCount = 20;

	private readonly log: FastifyBaseLogger;
	private readonly dc: DynamoDBDocumentClient;
	private readonly tableName: string;

	public constructor(log: FastifyBaseLogger, dc: DynamoDBDocumentClient, tableName: string, private readonly taskKey, private readonly taskItemKey) {
		this.log = log;
		this.dc = dc;
		this.tableName = tableName;
	}

	private getTaskItemTransactionWriteCommandInput(tableName: string, added: TaskItemResource[] = []): TransactWriteItemsCommandInput {
		const command: TransactWriteCommandInput = {
			TransactItems: [],
		};
		// First add the task items that need to be added
		for (const taskItem of added) {
			const { name, taskId, ...rest } = taskItem;
			const polygonTaskDbId = createDelimitedAttribute(this.taskKey, taskId);
			const taskItemDbId = createDelimitedAttribute(this.taskItemKey, name);
			const siKey2 = createDelimitedAttribute(this.taskItemKey, taskItem.status, taskId);

			command.TransactItems.push({
				// The Impact item
				Put: {
					TableName: tableName,
					Item: {
						pk: polygonTaskDbId,
						sk: taskItemDbId,
						siKey2,
						name,
						...rest,
					},
				},
			});
		}

		return command;
	}

	public async create(taskItems: TaskItemResource[]): Promise<void> {
		this.log.debug(`TaskItemRepository> create> taskItems:${JSON.stringify(taskItems)}`);

		const transaction = this.getTaskItemTransactionWriteCommandInput(this.tableName, taskItems);

		this.log.debug(`TaskItemRepository> create> transaction:${JSON.stringify(transaction)}`);
		await this.dc.send(new TransactWriteCommand(transaction));

		this.log.debug(`TaskItemRepository> create> exit>`);
	}

	public async get(taskId: string, name: string): Promise<TaskItemResource | undefined> {
		this.log.debug(`TaskItemRepository> get> taskId: ${taskId} id:${name}`);

		const polygonTaskDbId = createDelimitedAttribute(this.taskKey, taskId);
		const polygonTaskItemDbId = createDelimitedAttribute(this.taskItemKey, name);

		const params: GetCommandInput = {
			TableName: this.tableName,
			Key: {
				pk: polygonTaskDbId,
				sk: polygonTaskItemDbId,
			},
		};
		const response = await this.dc.send(new GetCommand(params));
		if (response.Item === undefined) {
			throw new NotFoundError(`Task item with TaskId: ${taskId} and name:${name} not found`);
		}

		// assemble before returning
		const taskItem = this.assemble(response.Item);
		this.log.debug(`TaskItemRepository> get> exit:${JSON.stringify(taskItem)}`);
		return taskItem;
	}

	public async list(taskId: string, options: TaskItemListOptions): Promise<[TaskItemResource[], string]> {
		this.log.info(`TaskItemRepository > list > TaskId: ${taskId} options:${JSON.stringify(options)} `);

		if (!options.count) {
			options.count = this.defaultCount;
		}

		let exclusiveStartKey;
		if (options?.exclusiveStart?.name) {
			exclusiveStartKey = {
				pk: createDelimitedAttribute(this.taskKey, taskId),
				sk: createDelimitedAttribute(this.taskItemKey, options.exclusiveStart.name),
			};
		}

		const params: QueryCommandInput = {
			TableName: this.tableName,
			KeyConditionExpression: `#hash=:hash  AND begins_with(#sortKey,:sortKey)`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
				'#sortKey': 'sk',
			},
			ExpressionAttributeValues: {
				':hash': createDelimitedAttribute(this.taskKey, taskId),
				':sortKey': createDelimitedAttributePrefix(this.taskItemKey),
			},
			Limit: options.count as number,
			ExclusiveStartKey: exclusiveStartKey,
		};

		if (options.status) {
			params.IndexName = this.GSI2;
			params.ExpressionAttributeNames = {
				'#hash': 'siKey2',
				'#sortKey': 'pk',
			};
			params.ExpressionAttributeValues = {
				':hash': createDelimitedAttribute(this.taskItemKey, options.status, taskId),
				':sortKey': createDelimitedAttributePrefix(this.taskKey),
			};

			if (options?.exclusiveStart?.name) {
				exclusiveStartKey.siKey2 = createDelimitedAttribute(this.taskItemKey, options.status, taskId);
			}
		}

		const items = await this.dc.send(new QueryCommand(params));
		if ((items.Items?.length ?? 0) === 0) {
			return [[], undefined];
		}

		let paginationKey: string;
		if (items.LastEvaluatedKey) {
			const lastEvaluatedName = String(expandDelimitedAttribute(items.LastEvaluatedKey['sk'])[1]);
			paginationKey = encodeURIComponent(lastEvaluatedName)
		}

		const taskItems: TaskItemResource[] = [];
		for (const i of items.Items) {
			taskItems.push(this.assemble(i));
		}

		this.log.debug(`TaskItemRepository> list> exit:${JSON.stringify([taskItems, paginationKey])}`);
		return [taskItems, paginationKey];
	}

	private assemble(i: DocumentDbClientItem): TaskItemResource | undefined {
		this.log.debug(`TaskItemRepository> assemble ${JSON.stringify(i)}`);
		if (i === undefined) {
			return undefined;
		}
		return {
			taskId: expandDelimitedAttribute(i['pk'])[1],
			name: i['name'],
			resourceId: i['resourceId'],
			status: i['status'],
			statusMessage: i['statusMessage'],
		};
	}

	public async delete(id: string): Promise<void> {
		this.log.debug(`TaskItemRepository> delete> id:${id}`);

		// keys
		const dbId = createDelimitedAttribute(this.taskKey, id);

		// list all items directly relating to the task item
		const params1: QueryCommandInput = {
			TableName: this.tableName,
			KeyConditionExpression: `#hash=:hash`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': dbId,
			},
		};

		const dbIds: { pk: string; sk: string }[] = [];
		let exclusiveStartKey: Record<string, any>;
		do {
			this.log.debug(`TaskItemRepository> delete> params1:${JSON.stringify(params1)}`);
			params1.ExclusiveStartKey = exclusiveStartKey;
			const data = await this.dc.send(new QueryCommand(params1));
			this.log.debug(`TaskItemRepository> delete> data:${JSON.stringify(data)}`);
			if (data.Count > 0) {
				dbIds.push(...data.Items.map((i) => ({ pk: i['pk'], sk: i['sk'] })));
			}
			exclusiveStartKey = data.LastEvaluatedKey;
		} while (exclusiveStartKey !== undefined);
		this.log.debug(`TaskItemRepository> delete> dbIds:${JSON.stringify(dbIds)}`);

		// delete all the activity related items
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

		try {
			this.log.debug(`TaskItemRepository> delete> transaction:${JSON.stringify(transaction)}`);
			const response = await this.dc.send(new TransactWriteCommand(transaction));
			this.log.debug(`TaskItemRepository> delete> response:${JSON.stringify(response)}`);
		} catch (err) {
			if (err instanceof Error) {
				if (err.name === 'TransactionCanceledException') {
					this.log.error(`TaskItemRepository> delete> err> ${JSON.stringify((err as TransactionCanceledException).CancellationReasons)}`);
					throw new DatabaseTransactionError((err as TransactionCanceledException).CancellationReasons as TransactionCancellationReason[]);
				} else {
					this.log.error(err);
					throw err;
				}
			}
		}

		this.log.debug(`ActivityTaskItemRepository> delete> exit>`);
	}
}

export interface TaskItemListOptions {
	count?: number;
	exclusiveStart?: TaskItemListPaginationKey;
	status?: TaskItemStatus;
}

export interface TaskItemListPaginationKey {
	name: string;
}

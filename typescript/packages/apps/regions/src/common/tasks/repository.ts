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

import { FastifyBaseLogger } from "fastify";
import {
	BatchGetCommandInput,
	DynamoDBDocumentClient,
	GetCommand,
	GetCommandInput,
	QueryCommand,
	QueryCommandInput,
	TransactWriteCommand,
	TransactWriteCommandInput,
	UpdateCommandInput
} from "@aws-sdk/lib-dynamodb";
import { createDelimitedAttribute, DocumentDbClientItem } from "../../common/ddbAttributes.util.js";
import { TaskBatchProgress, TaskResource } from "./schemas.js";
import { DatabaseTransactionError, NotFoundError, TransactionCancellationReason } from "../../common/errors.js";
import { DynamoDbUtils } from "@agie/dynamodb-utils";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";


export class TaskRepository {

	public constructor(private readonly log: FastifyBaseLogger, private readonly dc: DynamoDBDocumentClient, private readonly tableName: string, private readonly dynamoDbUtils: DynamoDbUtils, private readonly taskKey) {
	}

	public async updateProgress(taskBatchProgress: TaskBatchProgress): Promise<void> {
		this.log.debug(`TaskRepository> incrementBatches> in: taskResource:${JSON.stringify(taskBatchProgress)}`);

		const dbId = createDelimitedAttribute(this.taskKey, taskBatchProgress.taskId);
		const command: UpdateCommandInput = {
			TableName: this.tableName,
			Key: {
				pk: dbId,
				sk: dbId,
			},
			UpdateExpression: 'set batchesCompleted = batchesCompleted + :val, itemsFailed = itemsFailed + :failed, itemsSucceeded = itemsSucceeded + :succeeded, updatedAt = :updatedAt',
			ExpressionAttributeValues: {
				':succeeded': taskBatchProgress.itemsSucceeded,
				':failed': taskBatchProgress.itemsFailed,
				':updatedAt': new Date(Date.now()).toISOString(),
				':val': 1,
			},
			ReturnValues: 'ALL_NEW',
		};

		await this.dynamoDbUtils.update(command);

		this.log.debug(`TaskRepository> incrementBatches> exit`);
	}

	public async updateStatus(taskId: string, status: string): Promise<void> {
		this.log.debug(`TaskRepository> updateStatus> in:`);

		const dbId = createDelimitedAttribute(this.taskKey, taskId);
		const command: UpdateCommandInput = {
			TableName: this.tableName,
			Key: {
				pk: dbId,
				sk: dbId,
			},
			UpdateExpression: 'set taskStatus = :s, updatedAt = :updatedAt',
			ExpressionAttributeValues: {
				':s': status,
				':updatedAt': new Date(Date.now()).toISOString(),
			},
			ReturnValues: 'ALL_NEW',
		};

		if (status === 'inProgress') {
			command.ConditionExpression = 'batchesCompleted < batchesTotal';
		}

		if (status === 'success') {
			command.ConditionExpression = 'batchesCompleted = batchesTotal';
		}

		await this.dynamoDbUtils.update(command);

		this.log.debug(`TaskRepository> incrementBatches> exit`);
	}


	public async listByIds(taskIds: string[]): Promise<TaskResource[]> {
		this.log.debug(`TaskRepository> listByIds> in> taskIds:${JSON.stringify(taskIds)}`);

		if ((taskIds?.length ?? 0) === 0) {
			this.log.debug(`TaskRepository> listByIds> early exit:[]`);
			return [];
		}

		// retrieve the activity items
		const params: BatchGetCommandInput = {
			RequestItems: {},
		};
		params.RequestItems[this.tableName] = {
			Keys: taskIds.map((i) => ({
				pk: createDelimitedAttribute(this.taskKey, i),
				sk: createDelimitedAttribute(this.taskKey, i),
			})),
		};

		this.log.debug(`TaskRepository> listByIds> params:${JSON.stringify(params)}`);
		const items = await this.dynamoDbUtils.batchGetAll(params);
		this.log.debug(`TaskRepository> listByIds> items:${JSON.stringify(items)}`);

		if (items?.Responses?.[this.tableName] === undefined) {
			this.log.debug('TaskRepository> listByIds> exit: commands:undefined');
			return [];
		}

		const tasks = items.Responses[this.tableName].sort((a, b) => (a['pk'] as string).localeCompare(b['pk']) || (a['sk'] as string).localeCompare(b['sk'])).map((i) => this.assemble(i));

		this.log.debug(`TaskRepository> listByIds> exit:${JSON.stringify(tasks)}`);
		return tasks;
	}

	private assemble(i: DocumentDbClientItem): TaskResource | undefined {
		if (i === undefined) {
			return undefined;
		}
		const task: TaskResource = {
			id: i['id'],
			taskType: i['taskType'],
			taskStatus: i['taskStatus'],
			statusMessage: i['statusMessage'],
			itemsTotal: i['itemsTotal'],
			itemsSucceeded: i['itemsSucceeded'],
			itemsFailed: i['itemsFailed'],
			// possibly remove the batchesCompleted/batchesTotal attributes if no longer needed
			batchesCompleted: i['batchesCompleted'],
			batchesTotal: i['batchesTotal'],
			progress: i['progress'],
			createdAt: i['createdAt'],
			createdBy: i['createdBy'],
			updatedAt: i['updatedAt'],
			updatedBy: i['updatedBy'],
		};
		// calculate progress within the assembler
		task.progress = (task.batchesCompleted / task.batchesTotal) * 100;

		return task;
	}

	public async get(taskId: string): Promise<TaskResource | undefined> {
		this.log.debug(`TaskRepository> get> taskId:${taskId}`);

		const dbId = createDelimitedAttribute(this.taskKey, taskId);
		const params: GetCommandInput = {
			TableName: this.tableName,
			Key: {
				pk: dbId,
				sk: dbId,
			},
		};
		const response = await this.dc.send(new GetCommand(params));
		if (response.Item === undefined) {
			throw new NotFoundError(`Polygon task with id: ${taskId} not found`);
		}

		// assemble before returning
		const activityTask = this.assemble(response.Item);
		this.log.debug(`TaskRepository> get> exit:${JSON.stringify(activityTask)}`);
		return activityTask;
	}

	public async create(task: TaskResource): Promise<void> {
		this.log.debug(`TaskRepository> create> task:${JSON.stringify(task)}`);
		// keys
		const dbId = createDelimitedAttribute(this.taskKey, task.id);
		const params: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: dbId,
							sk: dbId,
							type: this.taskKey,
							...task,
						},
					},
				},
			],
		};
		await this.dc.send(new TransactWriteCommand(params));
		this.log.debug(`TaskRepository> create> exit>`);
	}

	public async delete(id: string): Promise<void> {
		this.log.debug(`TaskRepository> delete> id:${id}`);

		// keys
		const dbId = createDelimitedAttribute(this.taskKey, id);

		// list all items directly relating to the activity
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
			this.log.debug(`TaskRepository> delete> params1:${JSON.stringify(params1)}`);
			params1.ExclusiveStartKey = exclusiveStartKey;
			const data = await this.dc.send(new QueryCommand(params1));
			this.log.debug(`TaskRepository> delete> data:${JSON.stringify(data)}`);
			if (data.Count > 0) {
				dbIds.push(...data.Items.map((i) => ({ pk: i['pk'], sk: i['sk'] })));
			}
			exclusiveStartKey = data.LastEvaluatedKey;
		} while (exclusiveStartKey !== undefined);
		this.log.debug(`TaskRepository> delete> dbIds:${JSON.stringify(dbIds)}`);

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
			this.log.debug(`TaskRepository> delete> transaction:${JSON.stringify(transaction)}`);
			const response = await this.dc.send(new TransactWriteCommand(transaction));
			this.log.debug(`TaskRepository> delete> response:${JSON.stringify(response)}`);
		} catch (err) {
			if (err instanceof Error) {
				if (err.name === 'TransactionCanceledException') {
					this.log.error(`TaskRepository> delete> err> ${JSON.stringify((err as TransactionCanceledException).CancellationReasons)}`);
					throw new DatabaseTransactionError((err as TransactionCanceledException).CancellationReasons as TransactionCancellationReason[]);
				} else {
					this.log.error(err);
					throw err;
				}
			}
		}

		this.log.debug(`TaskRepository> delete> exit>`);
	}

}

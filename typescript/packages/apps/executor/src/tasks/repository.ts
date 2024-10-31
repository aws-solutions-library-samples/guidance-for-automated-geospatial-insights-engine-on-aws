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

import { createDelimitedAttribute, DocumentDbClientItem, DynamoDbUtils, expandDelimitedAttribute } from '@agie/dynamodb-utils';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, QueryCommandInput, TransactWriteCommand, TransactWriteCommandInput, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { PkType } from '../common/pkUtils.js';
import { ListPaginationOptions } from '../common/schemas.js';
import { TaskBatchProgress, TaskResource } from './schemas.js';

export class ExecutionTaskRepository {
	private gsi1IndexName = 'siKey1-sk-index';

	public constructor(
		private readonly log: FastifyBaseLogger,
		private readonly dc: DynamoDBDocumentClient,
		private readonly tableName: string,
		private readonly dynamoDbUtils: DynamoDbUtils
	) {}

	public async updateProgress(taskBatchProgress: TaskBatchProgress): Promise<void> {
		this.log.debug(`ExecutionTasksRepository> updateProgress> in: taskResource:${JSON.stringify(taskBatchProgress)}`);

		const dbId = createDelimitedAttribute(PkType.ExecutionTask, taskBatchProgress.taskId);
		const command: UpdateCommandInput = {
			TableName: this.tableName,
			Key: {
				pk: dbId,
				sk: dbId,
			},
			UpdateExpression:
				'set itemsCompleted = itemsCompleted + :val, itemsFailed = itemsFailed + :failed, itemsSucceeded = itemsSucceeded + :succeeded, updatedAt = :updatedAt',
			ExpressionAttributeValues: {
				':succeeded': taskBatchProgress.itemsSucceeded,
				':failed': taskBatchProgress.itemsFailed,
				':updatedAt': new Date(Date.now()).toISOString(),
				':val': 1,
			},
			ReturnValues: 'ALL_NEW',
		};

		await this.dynamoDbUtils.update(command);

		this.log.debug(`ExecutionTasksRepository> incrementBatches> exit`);
	}

	public async updateStatus(taskId: string, status: string): Promise<void> {
		this.log.debug(`ExecutionTasksRepository> updateStatus> in:`);

		const dbId = createDelimitedAttribute(PkType.ExecutionTask, taskId);
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
			command.ConditionExpression = 'itemsCompleted < itemsTotal';
		}

		if (status === 'success') {
			command.ConditionExpression = 'itemsCompleted = itemsTotal';
		}

		await this.dynamoDbUtils.update(command);

		this.log.debug(`ExecutionTasksRepository> incrementBatches> exit`);
	}

	public async list(sub: string, options: ListPaginationOptions): Promise<[TaskResource[], string | undefined]> {
		this.log.debug(`ExecutionTasksRepository> list> sub: ${sub}, options: ${JSON.stringify(options)}`);

		let exclusiveStartKey;

		const subDbId = createDelimitedAttribute(PkType.Subject, sub);

		if (options?.token) {
			exclusiveStartKey = {
				pk: createDelimitedAttribute(PkType.ExecutionTask, options.token),
				sk: createDelimitedAttribute(PkType.ExecutionTask, options.token),
				siKey1: subDbId,
			};
		}

		const params: QueryCommandInput = {
			TableName: this.tableName,
			IndexName: this.gsi1IndexName,
			KeyConditionExpression: `#hash=:hash AND begins_with(#sortKey,:sortKey)`,
			ExpressionAttributeNames: {
				'#hash': 'siKey1',
				'#sortKey': 'sk',
			},
			ExpressionAttributeValues: {
				':hash': createDelimitedAttribute(PkType.Subject, sub),
				':sortKey': createDelimitedAttribute(PkType.ExecutionTask),
			},
			Limit: options.count as number,
			ExclusiveStartKey: exclusiveStartKey,
		};

		const queryResponse = await this.dc.send(new QueryCommand(params));

		const taskResourceList = queryResponse.Items.map((i) => this.assemble(i));

		let nextToken: string;
		if (queryResponse.LastEvaluatedKey) {
			nextToken = expandDelimitedAttribute(queryResponse.LastEvaluatedKey['sk'])[1];
		}

		return [taskResourceList, nextToken];
	}

	private assemble(i: DocumentDbClientItem): TaskResource | undefined {
		this.log.debug(`ExecutionTaskItemsRepository> assemble ${JSON.stringify(i)}`);
		if (i === undefined) {
			return undefined;
		}
		const task: TaskResource = {
			id: expandDelimitedAttribute(i['sk'])[1],
			taskStatus: i['taskStatus'],
			regionId: i['regionId'],
			startDateTime: i['startDateTime'],
			endDateTime: i['endDateTime'],
			interval: i['interval'],
			itemsTotal: i['itemsTotal'],
			itemsSucceeded: i['itemsSucceeded'],
			itemsFailed: i['itemsFailed'],
			itemsCompleted: i['itemsCompleted'],
			createdAt: i['createdAt'],
			createdBy: i['createdBy'],
		};

		return task;
	}

	public async get(taskId: string): Promise<TaskResource> {
		this.log.debug(`ExecutionTasksRepository> get> taskId:${taskId}`);

		const taskDbId = createDelimitedAttribute(PkType.ExecutionTask, taskId);

		const getCommandResponse = await this.dc.send(
			new GetCommand({
				TableName: this.tableName,
				Key: {
					pk: taskDbId,
					sk: taskDbId,
				},
			})
		);

		if (!getCommandResponse.Item) return undefined;

		return this.assemble(getCommandResponse.Item);
	}

	public async create(sub: string, task: TaskResource): Promise<void> {
		this.log.debug(`ExecutionTasksRepository> create> task:${JSON.stringify(task)}`);

		// keys
		const subDbId = createDelimitedAttribute(PkType.Subject, sub);
		const taskDbId = createDelimitedAttribute(PkType.ExecutionTask, task.id);

		const params: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: taskDbId,
							sk: taskDbId,
							siKey1: subDbId,
							...task,
						},
					},
				},
			],
		};

		await this.dc.send(new TransactWriteCommand(params));

		this.log.debug(`ExecutionTasksRepository> create> exit>`);
	}
}

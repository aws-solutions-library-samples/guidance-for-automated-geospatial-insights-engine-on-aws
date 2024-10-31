import { createDelimitedAttribute, DocumentDbClientItem, DynamoDbUtils, expandDelimitedAttribute } from '@agie/dynamodb-utils';
import { NotFoundError } from '@agie/resource-api-base';
import { DynamoDBDocumentClient, GetCommand, GetCommandInput, PutCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { PkType } from '../common/pkUtils.js';
import { ListPaginationOptions } from '../common/schemas.js';
import { TaskItemResource } from './schemas.js';

export class ExecutionTaskItemRepository {
	public constructor(
		private readonly log: FastifyBaseLogger,
		private readonly dc: DynamoDBDocumentClient,
		private readonly tableName: string,
		private readonly dynamoDbUtils: DynamoDbUtils
	) {}

	public async create(taskItem: TaskItemResource): Promise<void> {
		this.log.debug(`ExecutionTaskItemsRepository> create> taskItem:${JSON.stringify(taskItem)}`);

		await this.dc.send(
			new PutCommand({
				TableName: this.tableName,
				Item: {
					pk: createDelimitedAttribute(PkType.ExecutionTask, taskItem.taskId),
					sk: createDelimitedAttribute(PkType.StartDate, taskItem.startDateTime),
					...taskItem,
				},
			})
		);

		this.log.debug(`ExecutionTaskItemsRepository> create> exit>`);
	}

	public async list(taskId: string, options: ListPaginationOptions): Promise<[TaskItemResource[], string | undefined]> {
		this.log.debug(`ExecutionTaskItemsRepository> list> taskId: ${taskId}, options: ${JSON.stringify(options)}`);

		let exclusiveStartKey: { pk: string; sk: string };

		if (options?.token) {
			exclusiveStartKey = {
				pk: createDelimitedAttribute(PkType.ExecutionTask, taskId),
				sk: createDelimitedAttribute(PkType.StartDate, options.token),
			};
		}

		const params: QueryCommandInput = {
			TableName: this.tableName,
			KeyConditionExpression: `#hash=:hash AND begins_with(#sortKey,:sortKey)`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
				'#sortKey': 'sk',
			},
			ExpressionAttributeValues: {
				':hash': createDelimitedAttribute(PkType.ExecutionTask, taskId),
				':sortKey': createDelimitedAttribute(PkType.StartDate),
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

	public async get(taskId: string, startDateTime: string): Promise<TaskItemResource | undefined> {
		this.log.debug(`ExecutionTaskItemsRepository> get> taskId: ${taskId} startDateTime:${startDateTime}`);

		const executionTaskDbId = createDelimitedAttribute(PkType.ExecutionTask, taskId);
		const startDateTimeDbId = createDelimitedAttribute(PkType.StartDate, startDateTime);

		const params: GetCommandInput = {
			TableName: this.tableName,
			Key: {
				pk: executionTaskDbId,
				sk: startDateTimeDbId,
			},
		};
		const response = await this.dc.send(new GetCommand(params));
		if (response.Item === undefined) {
			throw new NotFoundError(`Task item with TaskId: ${taskId} and startDateTime:${startDateTime} not found`);
		}

		// assemble before returning
		const taskItem = this.assemble(response.Item);
		this.log.debug(`ExecutionTaskItemsRepository> get> exit:${JSON.stringify(taskItem)}`);
		return taskItem;
	}

	private assemble(i: DocumentDbClientItem): TaskItemResource | undefined {
		this.log.debug(`ExecutionTaskItemsRepository> assemble ${JSON.stringify(i)}`);
		if (i === undefined) {
			return undefined;
		}
		const taskItem: TaskItemResource = {
			taskId: expandDelimitedAttribute(i['pk'])[1],
			status: i['status'],
			statusMessage: i['statusMessage'],
			regionId: i['regionId'],
			resultId: i['resultId'],
			startDateTime: i['startDateTime'],
		};

		return taskItem;
	}
}

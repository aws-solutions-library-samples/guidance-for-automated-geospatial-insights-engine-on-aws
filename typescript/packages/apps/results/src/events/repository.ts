import type { PipelineMetadataListOptions } from "../api/schemas.js";
import type { BaseLogger } from "pino";
import { createDelimitedAttribute, DocumentDbClientItem } from "@arcade/dynamodb-utils";
import { PkType } from "../common/pkUtils.js";
import { DynamoDBDocumentClient, GetCommand, PutCommand, PutCommandInput, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { PipelineMetadataDetails } from "@arcade/events";

export class ResultsRepository {

	constructor(private readonly log: BaseLogger, private readonly dynamoDBClient: DynamoDBDocumentClient, private readonly tableName: string) {
	}

	public async get(executionId: string, zoneId: string): Promise<PipelineMetadataDetails | undefined> {
		this.log.debug(`ResultsRepository> get> executionId: ${executionId}, zoneId: ${zoneId}`);

		const zoneIdKey = createDelimitedAttribute(PkType.ZoneId, zoneId);
		const executionIdKey = createDelimitedAttribute(PkType.ExecutionId, executionId);

		const response = await this.dynamoDBClient.send(new GetCommand({
			TableName: this.tableName,
			Key: {
				pk: executionIdKey,
				sk: zoneIdKey
			}
		}));
		if (response.Item === undefined) {
			this.log.debug(`ResultsRepository> get> early exit: undefined`);
			return undefined;
		}
		this.log.debug(`ResultsRepository> list> response:${JSON.stringify(response)}`);
		return this.assemble(response.Item);
	}

	public async list(executionId: string, options: PipelineMetadataListOptions): Promise<[PipelineMetadataDetails[], string]> {
		this.log.info(`ResultsRepository> list> executionId:${executionId}`);
		const executionIdKey = createDelimitedAttribute(PkType.ExecutionId, executionId);

		// list all items directly relating to the execution
		const queryCommandParams: QueryCommandInput = {
			TableName: this.tableName,
			KeyConditionExpression: `#hash=:hash`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': executionIdKey,
			},
			Limit: options?.count,
			ExclusiveStartKey: options?.lastEvaluatedToken ? {
				pk: executionIdKey,
				sk: options.lastEvaluatedToken
			} : undefined
		};

		try {
			const response = await this.dynamoDBClient.send(new QueryCommand(queryCommandParams));
			this.log.debug(`ResultsRepository> list> response:${JSON.stringify(response)}`);
			return [this.assemblePipelineMetadataList(response.Items), response?.LastEvaluatedKey?.['sk']]
		} catch (err) {
			if (err instanceof Error) {
				this.log.error(err);
				throw err;
			}
		}
		this.log.info(`ResultsRepository> list> exit`);
		return [[], undefined]
	}

	public async put(pipelineMetadata: PipelineMetadataDetails): Promise<void> {
		this.log.info(`ResultsRepository> put> pipelineMetadata:${JSON.stringify(pipelineMetadata)}`);
		const executionIdKey = createDelimitedAttribute(PkType.ExecutionId, pipelineMetadata.executionId);
		const zoneIdKey = createDelimitedAttribute(PkType.ZoneId, pipelineMetadata.zoneId);
		const params: PutCommandInput = {
			TableName: this.tableName,
			Item: {
				pk: executionIdKey,
				sk: zoneIdKey,
				...pipelineMetadata
			}
		};

		try {
			const response = await this.dynamoDBClient.send(new PutCommand(params));
			this.log.debug(`ResultsRepository> put> response:${JSON.stringify(response)}`);
		} catch (err) {
			if (err instanceof Error) {
				this.log.error(err);
				throw err;
			}
		}
		this.log.info(`ResultsRepository> put> exit`);
	}

	private assemblePipelineMetadataList(items: Record<string, any>[]): PipelineMetadataDetails[] {
		this.log.trace(`ResultsRepository> assemblePipelineMetadataList> in> items:${JSON.stringify(items)}`);

		const pipelineMetadataList = [];
		for (const item of items) {
			pipelineMetadataList.push(this.assemble(item));
		}
		this.log.trace(`ResultsRepository> assemblePipelineMetadataList> exit>  PipelineMetadataList:${JSON.stringify(pipelineMetadataList)}`);

		return pipelineMetadataList;
	}

	private assemble(item: DocumentDbClientItem): PipelineMetadataDetails | undefined {
		this.log.trace(`ResultsRepository> assemble> in> item:${JSON.stringify(item)}`);

		if (item === undefined) {
			return undefined;
		}
		this.log.trace(`ResultsRepository> assembler> exit>`);

		return {
			executionId: item['executionId'],
			groupId: item['groupId'],
			regionId: item['regionId'],
			zoneId: item['zoneId'],
			stateId: item['stateId'],
			jobArn: item['jobArn'],
			createdAt: item['createdAt'],
			updatedAt: item['updatedAt'],
			status: item['status'],
			engineOutPutLocation: item['engineOutPutLocation'],
			message: item['message']
		};
	}

}

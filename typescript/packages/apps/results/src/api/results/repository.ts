import { createDelimitedAttribute, DocumentDbClientItem, expandDelimitedAttribute } from '@arcade/dynamodb-utils';
import {
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	PutCommandInput,
	QueryCommand,
	QueryCommandInput
} from '@aws-sdk/lib-dynamodb';
import type { BaseLogger } from 'pino';
import { PkType } from "../../common/pkUtils.js";
import { Result, ResultListOptions } from "./schemas.js";

export class ResultsRepository {
	constructor(private readonly log: BaseLogger, private readonly dynamoDBClient: DynamoDBDocumentClient, private readonly tableName: string) {}

	public async get(regionId: string, resultId: string): Promise<Result | undefined> {
		this.log.debug(`ResultsRepository> get> executionId: ${regionId}, polygonId: ${resultId}`);

		const regionIdKey = createDelimitedAttribute(PkType.RegionId, regionId);
		const resultIdKey = createDelimitedAttribute(PkType.ResultId, resultId);

		const response = await this.dynamoDBClient.send(
			new GetCommand({
				TableName: this.tableName,
				Key: {
					pk: regionIdKey,
					sk: resultIdKey,
				},
			})
		);
		if (response.Item === undefined) {
			this.log.debug(`ResultsRepository> get> early exit: undefined`);
			return undefined;
		}
		this.log.debug(`ResultsRepository> list> response:${JSON.stringify(response)}`);
		return this.assemble(response.Item);
	}

	public async list(regionId: string, options: ResultListOptions): Promise<[Result[], string]> {
		this.log.info(`ResultsRepository> list> regionId:${regionId}`);
		const executionIdKey = createDelimitedAttribute(PkType.RegionId, regionId);

		// list all items directly relating to the execution
		const queryCommandParams: QueryCommandInput = {
			TableName: this.tableName,
			// ensure that we return the latest result first
			ScanIndexForward: false,
			KeyConditionExpression: `#hash=:hash`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': executionIdKey,
			},
			Limit: options?.count,
			ExclusiveStartKey: options?.token
				? {
					pk: executionIdKey,
					sk: createDelimitedAttribute(PkType.ResultId, options.token),
				}
				: undefined,
		};

		try {
			const response = await this.dynamoDBClient.send(new QueryCommand(queryCommandParams));
			this.log.debug(`ResultsRepository> list> response:${JSON.stringify(response)}`);
			return [this.assembleResultList(response.Items), response?.LastEvaluatedKey ? encodeURIComponent(expandDelimitedAttribute(response.LastEvaluatedKey['sk'])[1]) : undefined];
		} catch (err) {
			if (err instanceof Error) {
				this.log.error(err);
				throw err;
			}
		}
		this.log.info(`ResultsRepository> list> exit`);
		return [[], undefined];
	}

	public async put(resultDetails: Result): Promise<void> {
		this.log.info(`ResultsRepository> put> resultDetails:${JSON.stringify(resultDetails)}`);
		const regionIdKey = createDelimitedAttribute(PkType.RegionId, resultDetails.regionId);
		const resultIdKey = createDelimitedAttribute(PkType.ResultId, resultDetails.id);
		const params: PutCommandInput = {
			TableName: this.tableName,
			Item: {
				pk: regionIdKey,
				sk: resultIdKey,
				...resultDetails,
			},
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

	private assembleResultList(items: Record<string, any>[]): Result[] {
		this.log.trace(`ResultsRepository> assembleResultList> in> items:${JSON.stringify(items)}`);
		const results = [];
		for (const item of items) {
			results.push(this.assemble(item));
		}
		this.log.trace(`ResultsRepository> assembleResultList> exit> results:${JSON.stringify(results)}`);
		return results;
	}

	private assemble(item: DocumentDbClientItem): Result | undefined {
		this.log.trace(`ResultsRepository> assemble> in> item:${JSON.stringify(item)}`);

		if (item === undefined) {
			return undefined;
		}
		this.log.trace(`ResultsRepository> assembler> exit>`);

		return {
			regionId: expandDelimitedAttribute(item['pk'])[1],
			id: expandDelimitedAttribute(item['sk'])[1],
			executionId: item['executionId'],
			createdAt: item['createdAt'],
			updatedAt: item['updatedAt'],
			status: item['status'],
			message: item['message'],
			engineType: item['engineType'],
		};
	}
}

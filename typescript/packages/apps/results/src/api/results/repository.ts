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

import { createDelimitedAttribute, DocumentDbClientItem, expandDelimitedAttribute } from '@agie/dynamodb-utils';
import { DynamoDBDocumentClient, GetCommand, PutCommand, PutCommandInput, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { BaseLogger } from 'pino';
import { PkType } from '../../common/pkUtils.js';
import { Result, ResultListOptions } from './schemas.js';

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

		const commonParams: Pick<QueryCommandInput, 'TableName' | 'ScanIndexForward' | 'Limit' | 'ExclusiveStartKey'> = {
			TableName: this.tableName,
			ScanIndexForward: false,
			Limit: options?.count,
			ExclusiveStartKey: options?.token
				? {
						pk: executionIdKey,
						sk: createDelimitedAttribute(PkType.ResultId, options.token),
				  }
				: undefined,
		};

		let queryCommandParams: QueryCommandInput;

		if (options.status) {
			let result: Result;
			if (options.token) {
				result = await this.get(regionId, options.token);
				options.token = result.endDateTime;
			}

			// list all items directly relating to the execution
			queryCommandParams = {
				...commonParams,
				IndexName: 'pk-siSort2-index',
				KeyConditionExpression: `#hash=:hash AND begins_with(#sort,:sort)`,
				ExpressionAttributeNames: {
					'#hash': 'pk',
					'#sort': 'siSort2',
				},
				ExpressionAttributeValues: {
					':hash': executionIdKey,
					':sort': createDelimitedAttribute(PkType.Status, options.status),
				},
				ExclusiveStartKey: options?.token
					? {
							...commonParams.ExclusiveStartKey,
							siSort2: createDelimitedAttribute(PkType.Status, options.status, PkType.EndDateTime, options.token),
					  }
					: undefined,
			};
		} else {
			// list all items directly relating to the execution
			queryCommandParams = {
				...commonParams,
				KeyConditionExpression: `#hash=:hash`,
				ExpressionAttributeNames: {
					'#hash': 'pk',
				},
				ExpressionAttributeValues: {
					':hash': executionIdKey,
				},
			};
		}

		try {
			const response = await this.dynamoDBClient.send(new QueryCommand(queryCommandParams));
			this.log.debug(`ResultsRepository> list> response:${JSON.stringify(response)}`);
			return [
				this.assembleResultList(response.Items),
				response?.LastEvaluatedKey ? encodeURIComponent(expandDelimitedAttribute(response.LastEvaluatedKey['sk'])[1]) : undefined,
			];
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
		const siSort2Key = createDelimitedAttribute(PkType.Status, resultDetails.status, PkType.EndDateTime, resultDetails.endDateTime);
		const params: PutCommandInput = {
			TableName: this.tableName,
			Item: {
				pk: regionIdKey,
				sk: resultIdKey,
				siSort2: siSort2Key,
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
			startDateTime: item['startDateTime'],
			endDateTime: item['endDateTime'],
			executionId: item['executionId'],
			createdAt: item['createdAt'],
			updatedAt: item['updatedAt'],
			status: item['status'],
			message: item['message'],
			engineType: item['engineType'],
		};
	}
}

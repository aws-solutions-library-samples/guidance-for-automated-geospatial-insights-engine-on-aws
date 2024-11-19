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
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, PutCommandInput, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { PkType } from '../../common/pkUtils.js';
import { NextToken } from '../../common/schemas.js';
import { EngineResource } from './schemas.js';

export class EngineRepository {
	private gsi1IndexName = 'siKey1-sk-index';

	public constructor(private readonly log: FastifyBaseLogger, private readonly dc: DynamoDBDocumentClient, private readonly tableName: string) {}

	public async list(options: any): Promise<[EngineResource[], NextToken]> {
		this.log.debug(`EngineRepository> list> options: ${JSON.stringify(options)}`);

		let exclusiveStartKey;

		if (options?.token) {
			exclusiveStartKey = {
				pk: createDelimitedAttribute(PkType.Engine, options.token),
				sk: createDelimitedAttribute(PkType.Engine, options.token),
				siKey1: createDelimitedAttribute(PkType.EngineType),
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
				':hash': createDelimitedAttribute(PkType.EngineType),
				':sortKey': createDelimitedAttribute(PkType.Engine),
			},
			Limit: options.count as number,
			ExclusiveStartKey: exclusiveStartKey,
		};

		const queryResponse = await this.dc.send(new QueryCommand(params));

		const engineResourceList = queryResponse.Items.map((i) => this.assemble(i));

		let nextToken: string;
		if (queryResponse.LastEvaluatedKey) {
			nextToken = expandDelimitedAttribute(queryResponse.LastEvaluatedKey['sk'])[1];
		}

		return [engineResourceList, nextToken];
	}

	public async delete(id: string): Promise<void> {
		this.log.info(`EngineRepository> delete> in> id: ${id}`);

		const engineDbId = createDelimitedAttribute(PkType.Engine, id);

		await this.dc.send(
			new DeleteCommand({
				TableName: this.tableName,
				Key: {
					pk: engineDbId,
					sk: engineDbId,
				},
			})
		);

		this.log.info(`EngineRepository> delete> exit>`);
	}
	public async create(engineResource: EngineResource): Promise<void> {
		this.log.info(`EngineRepository> create> in> engineResource: ${JSON.stringify(engineResource)}`);

		// keys
		const engineDbId = createDelimitedAttribute(PkType.Engine, engineResource.id);

		const params: PutCommandInput = {
			TableName: this.tableName,
			Item: {
				pk: engineDbId,
				sk: engineDbId,
				siKey1: createDelimitedAttribute(PkType.EngineType),
				...engineResource,
			},
		};

		await this.dc.send(new PutCommand(params));

		this.log.info(`EngineRepository> create> exit>`);
	}

	public async get(id: string): Promise<EngineResource> {
		this.log.info(`EngineRepository> get> in> id: ${id}`);

		const engineDbId = createDelimitedAttribute(PkType.Engine, id);

		const getResponse = await this.dc.send(
			new GetCommand({
				TableName: this.tableName,
				Key: { pk: engineDbId, sk: engineDbId },
			})
		);

		if (!getResponse.Item) return undefined;

		const engine = this.assemble(getResponse.Item);

		this.log.info(`EngineRepository> get> exit> ${JSON.stringify(engine)}`);
		return engine;
	}

	private assemble(i: DocumentDbClientItem): EngineResource | undefined {
		this.log.debug(`EngineRepository> assemble ${JSON.stringify(i)}`);
		if (i === undefined) {
			return undefined;
		}
		const engine: EngineResource = {
			id: expandDelimitedAttribute(i['pk'])[1],
			name: i['name'],
			jobRoleArn: i['jobRoleArn'],
			jobDefinitionArn: i['jobDefinitionArn'],
			image: i['image'],
			memory: i['memory'],
			vcpus: i['vcpus'],
			environment: i['environment'],
			createdAt: i['createdAt'],
			createdBy: i['createdBy'],
			updatedAt: i['updatedAt'],
			updatedBy: i['updatedBy'],
		};

		return engine;
	}
}

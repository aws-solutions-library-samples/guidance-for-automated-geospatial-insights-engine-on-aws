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

import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BaseLogger } from 'pino';
import { createDelimitedAttribute, expandDelimitedAttribute } from '../common/ddbAttributes.util.js';
import { PkType } from '../common/pkUtils.js';
import { BatchEngineRun } from './model.js';

export class JobsRepository {
	constructor(private readonly log: BaseLogger, private readonly dynamoDBClient: DynamoDBDocumentClient, private readonly tableName: string) {}

	public async get(regionId: string, scheduleDay: string): Promise<BatchEngineRun | undefined> {
		this.log.info(`JobsRepository> get> regionId: ${regionId}, scheduleDay: ${scheduleDay}`);

		const response = await this.dynamoDBClient.send(
			new GetCommand({
				Key: {
					pk: createDelimitedAttribute(PkType.RegionId, regionId),
					sk: createDelimitedAttribute(PkType.Day, scheduleDay),
				},
				TableName: this.tableName,
			})
		);

		const engineRun = response.Item
			? {
					regionId: expandDelimitedAttribute(response.Item['pk'])[1],
					scheduleDay: expandDelimitedAttribute(response.Item['sk'])[1],
			  }
			: undefined;

		this.log.info(`JobsRepository> get> exit> engineRun: ${engineRun}`);

		return engineRun;
	}

	public async save(regionId: string, scheduleDay: string): Promise<void> {
		this.log.info(`JobsRepository> save> regionId: ${regionId}, scheduleDay: ${scheduleDay}`);
		const expirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // Current timestamp + 1 day in seconds

		await this.dynamoDBClient.send(
			new PutCommand({
				Item: {
					pk: createDelimitedAttribute(PkType.RegionId, regionId),
					sk: createDelimitedAttribute(PkType.Day, scheduleDay),
					ttl: expirationTime,
				},
				TableName: this.tableName,
			})
		);

		this.log.info(`JobsRepository> save> exit:`);
	}
}

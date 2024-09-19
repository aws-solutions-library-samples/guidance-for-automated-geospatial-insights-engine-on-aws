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

import pino from "pino";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, GetCommandInput, PutCommand, PutCommandInput, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { Subscription, SubscriptionListOptions, SubscriptionWithUserId } from "./schemas.js";
import { createDelimitedAttribute, DocumentDbClientItem, expandDelimitedAttribute } from "@agie/dynamodb-utils";
import { PkType } from "../../common/pkUtils.js";
import BaseLogger = pino.BaseLogger;

export class SubscriptionsRepository {

	constructor(readonly log: BaseLogger, readonly dynamoDBClient: DynamoDBDocumentClient, private readonly tableName: string, private readonly gsi1IndexName: string) {
	}

	private assemble(item: DocumentDbClientItem): SubscriptionWithUserId | undefined {
		this.log.trace(`SubscriptionsRepository> assemble> in> item:${JSON.stringify(item)}`);

		if (item === undefined) {
			return undefined;
		}
		this.log.trace(`SubscriptionsRepository> assembler> exit>`);
		return {
			id: expandDelimitedAttribute(item['sk'])[1],
			userId: item['userId'],
			regionId: item['regionId'],
			createdAt: item['createdAt'],
			subscriptionArn: item['subscriptionArn'],
		};
	}

	private assembleResultList(items: Record<string, any>[]): SubscriptionWithUserId[] {
		this.log.trace(`SubscriptionsRepository> assembleResultList> in> items:${JSON.stringify(items)}`);
		const results = [];
		for (const item of items) {
			results.push(this.assemble(item));
		}
		this.log.trace(`SubscriptionsRepository> assembleResultList> exit> results:${JSON.stringify(results)}`);
		return results;
	}

	public async list(userId: string, options: SubscriptionListOptions): Promise<[Subscription[], string]> {
		this.log.info(`SubscriptionsRepository> list> userId:${userId}`);

		const userIdKey = createDelimitedAttribute(PkType.UserId, userId);
		// list all items directly relating to the execution
		const queryCommandParams: QueryCommandInput = {
			TableName: this.tableName,
			KeyConditionExpression: `#hash=:hash`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': userIdKey,
			},
			Limit: options?.count,
			ExclusiveStartKey: options?.lastEvaluatedToken
				? {
					pk: userIdKey,
					sk: createDelimitedAttribute(PkType.SubscriptionId, options.lastEvaluatedToken),
				}
				: undefined,
		};

		try {
			const response = await this.dynamoDBClient.send(new QueryCommand(queryCommandParams));
			this.log.debug(`SubscriptionsRepository> list> response:${JSON.stringify(response)}`);
			const nextToken = response?.LastEvaluatedKey?.['sk'] == undefined ? undefined : expandDelimitedAttribute(response?.LastEvaluatedKey?.['sk'])[1];
			return [this.assembleResultList(response.Items), nextToken];
		} catch (err) {
			if (err instanceof Error) {
				this.log.error(err);
				throw err;
			}
		}
		this.log.info(`SubscriptionsRepository> list> exit`);
		return [[], undefined];
	}

	public async delete(userId: string, subscriptionId: string): Promise<void> {
		this.log.debug(`SubscriptionsRepository> delete> userId: ${userId}, subscriptionId: $subscriptionId}`);

		const userIdKey = createDelimitedAttribute(PkType.UserId, userId);
		const subscriptionIdKey = createDelimitedAttribute(PkType.SubscriptionId, subscriptionId);
		try {
			const response = await this.dynamoDBClient.send(new DeleteCommand({
				Key: {
					pk: userIdKey,
					sk: subscriptionIdKey
				}, TableName: this.tableName
			}));
			this.log.debug(`ResultsRepository> delete> response:${JSON.stringify(response)}`);
		} catch (err) {
			if (err instanceof Error) {
				this.log.error(err);
				throw err;
			}
		}
		this.log.info(`SubscriptionsRepository> delete> exit`);
	}

	public async get(userId: string, subscriptionId: string): Promise<SubscriptionWithUserId | undefined> {
		this.log.debug(`SubscriptionsRepository> get> userId: ${userId}, subscriptionId: ${subscriptionId}`);

		const userIdKey = createDelimitedAttribute(PkType.UserId, userId);
		const subscriptionIdKey = createDelimitedAttribute(PkType.SubscriptionId, subscriptionId);
		const getCommandParams: GetCommandInput = {
			Key: {
				pk: userIdKey,
				sk: subscriptionIdKey
			},
			TableName: this.tableName
		};
		const response = await this.dynamoDBClient.send(new GetCommand(getCommandParams));
		const subscription = response.Item ? this.assemble(response.Item) : undefined;
		this.log.debug(`SubscriptionsRepository> get> exit> subscription: ${JSON.stringify(subscription)}`);
		return subscription;
	}

	public async getByRegionId(userId: string, regionId: string): Promise<SubscriptionWithUserId | undefined> {
		this.log.debug(`SubscriptionsRepository> getByRegionId> userId: ${userId}, regionId: ${regionId}`);

		const userIdKey = createDelimitedAttribute(PkType.UserId, userId);
		const regionIdKey = createDelimitedAttribute(PkType.RegionId, regionId);

		const queryCommandParams: QueryCommandInput = {
			TableName: this.tableName,
			IndexName: this.gsi1IndexName,
			KeyConditionExpression: `#hash=:hash AND #sort=:sort`,
			ExpressionAttributeNames: {
				'#hash': 'siKey1',
				'#sort': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': regionIdKey,
				':sort': userIdKey,
			}
		};

		const response = await this.dynamoDBClient.send(new QueryCommand(queryCommandParams));
		const subscription = response.Items.length === 0 ? undefined : this.assemble(response.Items[0]);
		this.log.debug(`SubscriptionsRepository> get> exit> subscription: ${JSON.stringify(subscription)}`);
		return subscription;
	}


	public async create(subscription: SubscriptionWithUserId): Promise<void> {
		this.log.debug(`SubscriptionsRepository> create> subscription: ${JSON.stringify(subscription)}`);

		const userIdKey = createDelimitedAttribute(PkType.UserId, subscription.userId);
		const subscriptionIdKey = createDelimitedAttribute(PkType.SubscriptionId, subscription.id);
		const regionIdKey = createDelimitedAttribute(PkType.RegionId, subscription.regionId);

		const params: PutCommandInput = {
			TableName: this.tableName,
			Item: {
				pk: userIdKey,
				sk: subscriptionIdKey,
				siKey1: regionIdKey,
				userId: subscription.userId,
				regionId: subscription.regionId,
				...subscription,
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
		this.log.info(`SubscriptionsRepository> put> exit`);
	}

}

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

import { DynamoDBDocumentClient, ExecuteStatementCommand, ExecuteStatementCommandInput, QueryCommand, QueryCommandInput, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { PkType } from '../common/pkTypes.js';
import { Tags } from '../common/schemas.js';
import { CommonRepository, DynamoDBItems, ResourceId } from './repository.common.js';
import { ListPaginationOptions } from './service.common.js';

describe('CommonRepository', () => {
	const mockedDocumentClient = mockClient(DynamoDBDocumentClient);
	const tableName = 'my-table';
	let underTest: CommonRepository;

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';
		mockedDocumentClient.reset();
		underTest = new CommonRepository(logger, mockedDocumentClient as unknown as DynamoDBDocumentClient, tableName);
	});

	it('addTags happy path', async () => {
		const tags: Tags = {
			tag1: 'tag-one',
			tag2: 'tag-two',
		};
		const owningResourceDbId = 'myDbId';
		const transaction: TransactWriteCommandInput = {
			TransactItems: [],
		};

		underTest.addTags(tags, owningResourceDbId, transaction);

		expect(transaction).toEqual({
			TransactItems: [
				{
					Put: {
						TableName: tableName,
						Item: {
							pk: owningResourceDbId,
							sk: 'tk:tag1',
							siKey1: 'tk:tag1:tv:tag-one',
							type: PkType.TagKey,
							key: 'tag1',
							value: 'tag-one',
						},
					},
				},
				{
					Put: {
						TableName: tableName,
						Item: {
							pk: owningResourceDbId,
							sk: 'tk:tag2',
							siKey1: 'tk:tag2:tv:tag-two',
							type: PkType.TagKey,
							key: 'tag2',
							value: 'tag-two',
						},
					},
				},
			],
		});
	});

	it('prepareDeleteItemsTransaction happy path', async () => {
		// input
		const resourcePrefix = PkType.Region;
		const id = 'my-id';

		// mocks
		mockedDocumentClient
			.on(QueryCommand)
			.resolvesOnce({
				Count: 2,
				Items: [
					{
						pk: 'my-pk-1',
						sk: 'my-sk-1',
					},
					{
						pk: 'my-pk-2',
						sk: 'my-sk-2',
					},
				],
				LastEvaluatedKey: {
					pk: 'my-pk-2',
					sk: 'my-sk-2',
				},
			})
			.resolvesOnce({
				Count: 1,
				Items: [
					{
						pk: 'my-pk-3',
						sk: 'my-sk-3',
					},
				],
			});

		const actual = await underTest.prepareDeleteItemsTransaction(resourcePrefix, id);

		// verifications
		expect(actual).toEqual({
			TransactItems: [
				{
					Delete: {
						TableName: tableName,
						Key: {
							pk: 'my-pk-1',
							sk: 'my-sk-1',
						},
					},
				},
				{
					Delete: {
						TableName: tableName,
						Key: {
							pk: 'my-pk-2',
							sk: 'my-sk-2',
						},
					},
				},
				{
					Delete: {
						TableName: tableName,
						Key: {
							pk: 'my-pk-3',
							sk: 'my-sk-3',
						},
					},
				},
			],
		});

		// verify the first call to DynamoDB
		const spy1 = mockedDocumentClient.commandCalls(QueryCommand)[0];
		expect(spy1.args[0].input).toStrictEqual({
			TableName: tableName,
			KeyConditionExpression: `#hash=:hash`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': `${resourcePrefix}:${id}`,
			},
			ExclusiveStartKey: undefined,
		});
		// verify the second call to DynamoDB
		const spy2 = mockedDocumentClient.commandCalls(QueryCommand)[1];
		expect(spy2.args[0].input).toStrictEqual({
			TableName: tableName,
			KeyConditionExpression: `#hash=:hash`,
			ExpressionAttributeNames: {
				'#hash': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': `${resourcePrefix}:${id}`,
			},
			ExclusiveStartKey: {
				pk: 'my-pk-2',
				sk: 'my-sk-2',
			},
		});
	});

	it('prepareTagTransactionWrite happy path', async () => {
		// input
		const resourceId = 'my-id';
		const keyPrefix = PkType.Region;
		const added: Tags = {
			___name: 'my-name',
			tag1: 'tag-one',
		};
		const removed: string[] = ['tag2'];

		const actual = underTest.prepareTagTransactionWrite(resourceId, keyPrefix, added, removed);

		// verifications
		expect(actual).toEqual({
			TransactItems: [
				{
					Put: {
						TableName: tableName,
						Item: {
							pk: `${keyPrefix}:${resourceId}`,
							sk: 'tk:___name',
							siKey1: 'tk:___name:tv:my-name',
							type: PkType.TagKey,
							key: '___name',
							value: 'my-name',
						},
					},
				},
				{
					Put: {
						TableName: tableName,
						Item: {
							pk: `${keyPrefix}:${resourceId}`,
							sk: 'tk:tag1',
							siKey1: 'tk:tag1:tv:tag-one',
							type: PkType.TagKey,
							key: 'tag1',
							value: 'tag-one',
						},
					},
				},
				{
					Delete: {
						TableName: tableName,
						Key: {
							pk: `${keyPrefix}:${resourceId}`,
							sk: 'tk:tag2',
						},
					},
				},
			],
		});
	});

	it('listResourceIdsByTag happy path - no pagination', async () => {
		const tagKey = 'tag1';
		const tagValue = 'tag-one';
		const keyPrefix = PkType.Region;
		const pagination: ListPaginationOptions = undefined;

		const expectedMockInput: QueryCommandInput = {
			TableName: tableName,
			IndexName: 'siKey1-pk-index',
			KeyConditionExpression: `#hash=:hash AND begins_with(#sort,:sort)`,
			ExpressionAttributeNames: {
				'#hash': 'siKey1',
				'#sort': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': `tk:${tagKey}:tv:${tagValue}`,
				':sort': `${keyPrefix}:`,
			},
			ProjectionExpression: 'pk',
			ScanIndexForward: true,
		};
		mockedDocumentClient.on(QueryCommand, expectedMockInput).resolves({
			Count: 4,
			Items: [
				{
					pk: 'r:01',
				},
				{
					pk: 'r:02',
				},
				{
					pk: 'r:03',
				},
				{
					pk: 'r:04',
				},
			],
		});

		const actual = await underTest.listResourceIdsByTag(tagKey, tagValue, keyPrefix, pagination);

		const expected: [ResourceId[], ResourceId] = [['01', '02', '03', '04'], undefined];

		expect(actual).toStrictEqual(expected);
		expect(mockedDocumentClient.calls().length).toBe(1);
	});

	it('listResourceIdsByTag happy path - with pagination', async () => {
		const tagKey = 'tag1';
		const tagValue = 'tag-one';
		const keyPrefix = PkType.Region;
		const pagination: ListPaginationOptions = {
			count: 2,
			token: '02',
		};

		const expectedMockInput: QueryCommandInput = {
			TableName: tableName,
			IndexName: 'siKey1-pk-index',
			KeyConditionExpression: `#hash=:hash AND begins_with(#sort,:sort)`,
			ExpressionAttributeNames: {
				'#hash': 'siKey1',
				'#sort': 'pk',
			},
			ExpressionAttributeValues: {
				':hash': `tk:${tagKey}:tv:${tagValue}`,
				':sort': `${keyPrefix}:`,
			},
			ProjectionExpression: 'pk',
			ScanIndexForward: true,
			ExclusiveStartKey: {
				pk: 'r:02',
				sk: `tk:${tagKey}`,
				siKey1: `tk:${tagKey}:tv:${tagValue}`,
			},
			Limit: 2,
		};
		mockedDocumentClient.on(QueryCommand, expectedMockInput).resolves({
			Count: 4,
			Items: [
				{
					pk: 'r:03',
				},
				{
					pk: 'r:04',
				},
			],
		});

		const actual = await underTest.listResourceIdsByTag(tagKey, tagValue, keyPrefix, pagination);

		const expected: [ResourceId[], ResourceId] = [['03', '04'], '04'];

		expect(actual).toStrictEqual(expected);
		expect(mockedDocumentClient.calls().length).toBe(1);
	});

	it('listResourceIds happy path - without pagination', async () => {
		const resourcePrefix = PkType.Region;
		const pagination: ListPaginationOptions = undefined;

		const expectedMockInput: ExecuteStatementCommandInput = {
			Statement: `SELECT pk FROM "${tableName}"."type-sk-index" WHERE "type" = ? AND BEGINS_WITH("sk", ?)`,
			Parameters: [resourcePrefix, `${resourcePrefix}:`],
		};
		mockedDocumentClient.on(ExecuteStatementCommand, expectedMockInput).resolves({
			Items: [
				{
					pk: 'r:03',
				},
				{
					pk: 'r:04',
				},
			],
		});

		const actual = await underTest.listResourceIds(resourcePrefix, pagination);

		const expected: [ResourceId[], ResourceId] = [['03', '04'], undefined];

		expect(actual).toStrictEqual(expected);
		expect(mockedDocumentClient.calls().length).toBe(1);
	});

	it('listResourceIds happy path - with pagination', async () => {
		const resourcePrefix = PkType.Region;
		const pagination: ListPaginationOptions = {
			count: 2,
			token: 'abcxyz',
		};

		const expectedMockInput: ExecuteStatementCommandInput = {
			Statement: `SELECT pk FROM "${tableName}"."type-sk-index" WHERE "type" = ? AND BEGINS_WITH("sk", ?)`,
			Parameters: [resourcePrefix, `${resourcePrefix}:`],
			NextToken: pagination.token,
			Limit: pagination.count,
		};
		mockedDocumentClient.on(ExecuteStatementCommand, expectedMockInput).resolves({
			Items: [
				{
					pk: 'r:03',
				},
				{
					pk: 'r:04',
				},
			],
			NextToken: 'defabc',
		});

		const actual = await underTest.listResourceIds(resourcePrefix, pagination);

		const expected: [ResourceId[], ResourceId] = [['03', '04'], 'defabc'];

		expect(actual).toStrictEqual(expected);
		expect(mockedDocumentClient.calls().length).toBe(1);
	});

	it('listItemsByIds happy path', async () => {
		const resourcePrefix = PkType.Region;
		const resourceIds = ['A', 'B', 'C'];

		const expectedMockInput1: ExecuteStatementCommandInput = {
			Statement: `SELECT * FROM "${tableName}" WHERE "pk" IN ('r:a','r:b','r:c')`,
		};
		const expectedMockInput2: ExecuteStatementCommandInput = {
			Statement: `SELECT * FROM "${tableName}" WHERE "pk" IN ('r:a','r:b','r:c')`,
			NextToken: 'abcdef',
		};
		mockedDocumentClient
			.on(ExecuteStatementCommand, expectedMockInput1)
			.resolves({
				Items: [
					{
						pk: 'r:A',
					},
					{
						pk: 'r:B',
					},
				],
				NextToken: 'abcdef',
			})
			.on(ExecuteStatementCommand, expectedMockInput2)
			.resolves({
				Items: [
					{
						pk: 'r:C',
					},
				],
			});

		const actual = await underTest.listItemsByIds(resourcePrefix, resourceIds);

		const expected: DynamoDBItems = [
			{
				pk: 'r:A',
			},
			{
				pk: 'r:B',
			},
			{
				pk: 'r:C',
			},
		];

		expect(actual).toStrictEqual(expected);
		expect(mockedDocumentClient.calls().length).toBe(2);
	});

	it('assembleTags happy path', async () => {
		const items: DynamoDBItems = [
			{
				sk: `${PkType.Group}:group1`,
				type: PkType.Group,
			},
			{
				sk: `${PkType.TagKey}:tag1:${PkType.TagValue}:tag-one`,
				type: PkType.TagKey,
				key: 'tag1',
				value: 'tag-one',
			},
			{
				sk: `${PkType.TagKey}:tag2:${PkType.TagValue}:tag-two`,
				type: PkType.TagKey,
				key: 'tag2',
				value: 'tag-two',
			},
		];
		const tags: Tags = {};

		underTest.assembleTags(items, tags);

		expect(tags).toEqual({
			tag1: 'tag-one',
			tag2: 'tag-two',
		});
	});
});

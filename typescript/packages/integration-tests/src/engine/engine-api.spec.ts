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

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { create_group_body, create_polygon_body, create_region_body_without_schedule } from '../scheduler/scheduler.data.js';
import { getAuthToken } from '../utils/auth.js';
import { createResourcesMethodForModules } from '../utils/common.utils.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';
import { create_execution_task_body, created_execution_task_resource, ENGINE_INTEGRATION_TEST_TAG_KEY, ENGINE_INTEGRATION_TEST_TAG_VALUE } from './engine.data.js';
dayjs.extend(utc);

const TEST_PREFIX = 'engine module: ';

const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];
const DEFAULT_ENGINE_ID = process.env['AGIE_ENGINE_DEFAULT_ID'];
const ENVIRONMENT = process.env['ENVIRONMENT'];

// tag everything created in this test with the same tags, so can be torn down cleanly
const testTags = {
	[ENGINE_INTEGRATION_TEST_TAG_KEY]: ENGINE_INTEGRATION_TEST_TAG_VALUE,
};

const regions = createResourcesMethodForModules('regions');
const engine = createResourcesMethodForModules('engine');
const executor = createResourcesMethodForModules('executor');

const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await regions.teardownResources('polygons', ENGINE_INTEGRATION_TEST_TAG_KEY, ENGINE_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('regions', ENGINE_INTEGRATION_TEST_TAG_KEY, ENGINE_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('groups', ENGINE_INTEGRATION_TEST_TAG_KEY, ENGINE_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'Registration Resources', () => {
	let engineId: string, userToken: string, groupId: string, regionId: string, polygonId: string;

	beforeAll(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		const jobRoleArn = await engine
			.getResource('engines', {
				withIdToken: userToken,
				id: DEFAULT_ENGINE_ID,
				expectJsonLike: {
					id: DEFAULT_ENGINE_ID,
					name: `agie-${ENVIRONMENT}-engine-processor`,
				},
				expectStatus: 200,
			})
			.returns('.jobRoleArn');

		engineId = await engine
			.createResource('engines', {
				withIdToken: userToken,
				withJson: {
					name: 'sample-test-engine',
					jobRoleArn,
					image: 'hello-world:linux',
					memory: 2048,
					vcpus: 1,
					environment: {},
				},
				withTags: testTags,
				expectStatus: 201,
			})
			.returns('.id');
	});

	test('registering region to an engine - invalid engine id', async () => {
		await regions
			.createResource(
				'regions',
				{
					withIdToken: userToken,
					expectStatus: 404,
					expectJsonLike: {
						message: 'Engine with id: invalid-engine-id not found.',
					},
					withJson: {
						...create_region_body_without_schedule,
						processingConfig: {
							...create_region_body_without_schedule['processingConfig'],
							engineId: 'invalid-engine-id',
						},
					},
					withTags: testTags,
				},
				'groups',
				groupId
			)
			.returns('id');
	});

	test('registering region to an engine - valid engine id', { timeout: 5 * 60000 }, async () => {
		regionId = await regions
			.createResource(
				'regions',
				{
					withIdToken: userToken,
					expectStatus: 201,
					withJson: {
						...create_region_body_without_schedule,
						processingConfig: {
							...create_region_body_without_schedule['processingConfig'],
							engineId: engineId,
						},
					},
					withTags: testTags,
				},
				'groups',
				groupId
			)
			.returns('id');

		polygonId = await createPolygon(regionId, userToken);

		// Wait until the association is created between region and engine
		await engine.waitForListResources(
			`engines/${engineId}/registrations`,
			{
				expectStatus: 200,
				withIdToken: userToken,
				expectJsonLike: {
					registrations: [{ engineId: engineId, regionId, createdAt: ISO8601_DATE_TIME_MS_PATTERN }],
				},
			},
			{
				interval: 1000,
				timeout: 5 * 60000,
			}
		);

		// Should not allow user to delete engine if there is an existing region associated with it
		await engine.deleteResource('engines', { withIdToken: userToken, expectStatus: 400, id: engineId });
	});

	test('run processing with the new engine', { timeout: 5 * 60000 }, async () => {
		const taskId = await executor
			.createResource('executionTasks', {
				withIdToken: userToken,
				withJson: create_execution_task_body(regionId),
				withTags: testTags,
				expectJsonLike: created_execution_task_resource(ADMIN_USERNAME, regionId),
				expectStatus: 201,
			})
			.returns('id');

		await executor.waitForGetResource(
			'executionTasks',
			{
				expectStatus: 200,
				id: taskId,
				withIdToken: userToken,
				expectJsonLike: {
					taskStatus: 'success',
					itemsTotal: 2,
					itemsSucceeded: 2,
					itemsFailed: 0,
					itemsCompleted: 2,
				},
			},
			{
				interval: 1000,
				timeout: 5 * 60000,
			}
		);
	});

	test('unregistering region from engine', { timeout: 5 * 60000 }, async () => {
		await regions.deleteResource('polygons', { withIdToken: userToken, expectStatus: 204, id: polygonId });
		await regions.deleteResource('regions', { withIdToken: userToken, expectStatus: 204, id: regionId });
		await engine.waitForListResources(
			`engines/${engineId}/registrations`,
			{
				expectStatus: 200,
				withIdToken: userToken,
				expectJsonLike: {
					registrations: [],
				},
			},
			{
				interval: 1000,
				timeout: 5 * 60000,
			}
		);

		// Now that there is no region associated with the engine, engine can be deleted
		await engine.deleteResource('engines', { withIdToken: userToken, expectStatus: 204, id: engineId });
	});

	afterAll(async () => {
		await Promise.all([teardown()]);
	});
});

describe(TEST_PREFIX + 'Engine Resources', () => {
	let engineId: string, userToken: string;

	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	});

	test('creating engine - invalid role', { timeout: 5 * 60000 }, async () => {
		await engine
			.createResource('engines', {
				withIdToken: userToken,
				expectJsonLike: {
					message: 'The role with name invalid-role cannot be found.',
				},
				withJson: {
					name: 'sample-test-engine',
					jobRoleArn: 'arn:aws:iam::xxxxxxxxxx:role/invalid-role',
					image: 'hello-world:nanoserver-ltsc2022',
					memory: 2048,
					vcpus: 1,
					environment: {},
				},
				withTags: testTags,
				expectStatus: 400,
			})
			.toss();
	});

	test('creating engine - happy path', async () => {
		const jobRoleArn = await engine
			.getResource('engines', {
				withIdToken: userToken,
				id: DEFAULT_ENGINE_ID,
				expectJsonLike: {
					id: DEFAULT_ENGINE_ID,
					name: `agie-${ENVIRONMENT}-engine-processor`,
				},
				expectStatus: 200,
			})
			.returns('.jobRoleArn');

		engineId = await engine
			.createResource('engines', {
				withIdToken: userToken,
				withJson: {
					name: 'sample-test-engine',
					jobRoleArn,
					image: 'hello-world:nanoserver-ltsc2022',
					memory: 2048,
					vcpus: 1,
					environment: {},
				},
				expectJsonLike: {
					id: ID_PATTERN,
					name: 'sample-test-engine',
					jobRoleArn,
					image: 'hello-world:nanoserver-ltsc2022',
					memory: 2048,
					vcpus: 1,
					environment: {},
					createdAt: ISO8601_DATE_TIME_MS_PATTERN,
					createdBy: ADMIN_USERNAME,
				},
				withTags: testTags,
				expectStatus: 201,
			})
			.returns('.id');
	});

	test('listing engines - happy path', async () => {
		await engine.listResources('engines', {
			withIdToken: userToken,
			expectJsonLike: {
				engines: [
					{
						id: engineId,
						createdAt: ISO8601_DATE_TIME_MS_PATTERN,
						createdBy: ADMIN_USERNAME,
					},
				],
			},
			expectStatus: 200,
		});
	});

	test('delete engine - cannot delete engine created by system', async () => {
		await engine.deleteResource('engines', { withIdToken: userToken, expectStatus: 400, id: DEFAULT_ENGINE_ID });
	});

	test('delete engine - happy path', async () => {
		await engine.deleteResource('engines', { withIdToken: userToken, expectStatus: 204, id: engineId });
	});
});

const createGroup = async (idToken: string): Promise<string> => {
	return await regions
		.createResource('groups', {
			withIdToken: idToken,
			expectStatus: 201,
			withJson: create_group_body,
			withTags: testTags,
		})
		.returns('id');
};

const createPolygon = async (regionId: string, idToken: string): Promise<string> => {
	return await regions
		.createResource(
			'polygons',
			{
				withIdToken: idToken,
				expectStatus: 201,
				withJson: create_polygon_body,
				withTags: testTags,
			},
			'regions',
			regionId
		)
		.returns('id');
};

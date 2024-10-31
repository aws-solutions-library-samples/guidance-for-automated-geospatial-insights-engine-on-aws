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
import { afterEach, beforeEach, describe, test } from 'vitest';
import { create_group_body, create_polygon_body, create_region_body_without_schedule } from '../scheduler/scheduler.data.js';
import { getAuthToken } from '../utils/auth.js';
import { createResourcesMethodForModules } from '../utils/common.utils.js';
import { ID_PATTERN } from '../utils/regex.js';
import { create_execution_task_body, created_execution_task_resource, EXECUTOR_INTEGRATION_TEST_TAG_KEY, EXECUTOR_INTEGRATION_TEST_TAG_VALUE } from './executor.data.js';

dayjs.extend(utc);

const TEST_PREFIX = 'executor module: ';

const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

// tag everything created in this test with the same tags, so can be torn down cleanly
const testTags = {
	[EXECUTOR_INTEGRATION_TEST_TAG_KEY]: EXECUTOR_INTEGRATION_TEST_TAG_VALUE,
};

const regions = createResourcesMethodForModules('regions');
const executor = createResourcesMethodForModules('executor');

const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await regions.teardownResources('polygons', EXECUTOR_INTEGRATION_TEST_TAG_KEY, EXECUTOR_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('regions', EXECUTOR_INTEGRATION_TEST_TAG_KEY, EXECUTOR_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('groups', EXECUTOR_INTEGRATION_TEST_TAG_KEY, EXECUTOR_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'executionTasks', () => {
	let regionId: string, groupId: string, polygonId: string, stateId: string, userToken: string;

	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		regionId = await createRegionWithoutSchedule(groupId, userToken);
		polygonId = await createPolygon(regionId, userToken);
	});

	test('verify that tasks have finished execution with successful status', { timeout: 5 * 60000 }, async () => {
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
					itemsTotal: 3,
					itemsSucceeded: 3,
					itemsFailed: 0,
					itemsCompleted: 3,
				},
			},
			{
				interval: 1000,
				timeout: 5 * 60000,
			}
		);

		await executor.listResources(`executionTasks/${taskId}/taskItems`, {
			withIdToken: userToken,
			expectJsonLike: {
				taskItems: [
					{
						taskId: taskId,
						regionId: regionId,
						startDateTime: '2023-02-01T09:30:00.000Z',
						resultId: ID_PATTERN,
						status: 'success',
					},
					{
						taskId: taskId,
						regionId: regionId,
						startDateTime: '2023-03-01T09:30:00.000Z',
						resultId: ID_PATTERN,
						status: 'success',
					},
					{
						taskId: taskId,
						regionId: regionId,
						startDateTime: '2023-04-01T09:30:00.000Z',
						resultId: ID_PATTERN,
						status: 'success',
					},
				],
			},
			expectStatus: 200,
		});
	});

	afterEach(async () => {
		await Promise.all([teardown()]);
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

const createRegionWithoutSchedule = async (groupId: string, idToken: string): Promise<string> => {
	return await regions
		.createResource(
			'regions',
			{
				withIdToken: idToken,
				expectStatus: 201,
				withJson: create_region_body_without_schedule,
				withTags: testTags,
			},
			'groups',
			groupId
		)
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

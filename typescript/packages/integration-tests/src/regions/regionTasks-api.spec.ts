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

import { create_group_body } from "./groups.data.js";
import { createResourcesMethodForModules } from "../utils/common.utils.js";
import {
	create_region_task_body_with_group_id,
	created_region_task_resource,
	REGION_TASKS_INTEGRATION_TEST_TAG_KEY,
	REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE
} from "./regionTasks.data.js";
import { getAuthToken } from "../utils/auth.js";
import { afterEach, beforeEach, describe, test } from "vitest";
import { ID_PATTERN } from "../utils/regex.js";

const { createResource, deleteResource, getResource, listResources, teardownResources, updateResource, waitForGetResource } = createResourcesMethodForModules('regions');

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[REGION_TASKS_INTEGRATION_TEST_TAG_KEY]: REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE,
};

const TEST_PREFIX = 'regions module (regionTasks): ';
const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

const createGroup = async (idToken: string): Promise<string> => {
	return await createResource('groups', {
		withIdToken: idToken,
		expectStatus: 201,
		withJson: create_group_body,
		withTags: testTags,
	}).returns('id');
};

const createRegionTask = async (idToken: string, groupId: string): Promise<string> => {
	return await createResource(
		'regionTasks',
		{
			withIdToken: idToken,
			withJson: create_region_task_body_with_group_id(groupId, testTags),
			withTags: testTags,
			expectStatus: 201,
		}
	).returns('id');
};


const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await teardownResources('regions', REGION_TASKS_INTEGRATION_TEST_TAG_KEY, REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('groups', REGION_TASKS_INTEGRATION_TEST_TAG_KEY, REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE, idToken);
	const tasks = await listResources('regionTasks', { withIdToken: idToken, expectJsonLike: {}, expectStatus: 200 }).returns('tasks');
	for (const task of tasks) {
		await deleteResource('regionTasks', { id: task.id, withIdToken: idToken, expectStatus: 204 })
	}
};

describe(TEST_PREFIX + 'creating bulk tasks regions', () => {
	let groupId: string;
	let userToken: string;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
	});

	afterEach(async () => {
		await teardown();
	});

	test('creating regions in bulk - unspecified group id', async () => {
		await createResource(
			'regionTasks',
			{
				withIdToken: userToken,
				withJson: create_region_task_body_with_group_id(undefined, testTags),
				withTags: testTags,
				expectStatus: 400,
			}
		).toss();

		// because the request fails on fastify schema validation, the tasks are not created yet
		await listResources(`regionTasks`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				tasks: []
			}
		}).toss()
	});

	test('creating regions in bulk - invalid group id', async () => {
		const createRegionTasksRequest = create_region_task_body_with_group_id('invalidGroupId', testTags);
		const taskId = await createResource(
			'regionTasks',
			{
				withIdToken: userToken,
				withJson: createRegionTasksRequest,
				withTags: testTags,
				expectStatus: 201,
				expectJsonLike: created_region_task_resource(ADMIN_USERNAME, createRegionTasksRequest['items'].length)
			}
		).returns('id');

		await waitForGetResource('regionTasks', {
			expectStatus: 200,
			id: taskId,
			withIdToken: userToken,
			expectJsonLike: {
				taskStatus: 'success'
			}
		})


		// unlikes the previous example, in this case the request has passed schema validation, it will create the tasks
		await listResources(`regionTasks`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				tasks: [{
					"taskStatus": "success",
					"id": taskId,
					"taskType": "create",
				}]
			}
		}).toss()

		const expectedTaskItems = createRegionTasksRequest['items'].map(o => ({
			"name": o.name,
			"taskId": taskId,
			"status": "failure",
			"statusMessage": "Group 'invalidGroupId' not found."
		}))

		await listResources(`regionTasks/${taskId}/taskItems`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				taskItems: expectedTaskItems
			}
		}).toss()
	});

	test('creating regions in bulk - happy path', async () => {
		const createRegionTasksRequest = create_region_task_body_with_group_id(groupId, testTags);
		const taskId = await createResource(
			'regionTasks',
			{
				withIdToken: userToken,
				withJson: createRegionTasksRequest,
				withTags: testTags,
				expectStatus: 201,
				expectJsonLike: created_region_task_resource(ADMIN_USERNAME, createRegionTasksRequest['items'].length)
			}
		).returns('id');

		await waitForGetResource('regionTasks', {
			expectStatus: 200,
			id: taskId,
			withIdToken: userToken,
			expectJsonLike: {
				id: taskId,
				taskStatus: 'success'
			}
		})

		await listResources(`regionTasks`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				tasks: [{
					"taskStatus": "success",
					"id": taskId,
					"taskType": "create",
				}]
			}
		}).toss()

		const expectedTaskItems = createRegionTasksRequest['items'].map(o => ({
			"name": o.name,
			"taskId": taskId,
			"resourceId": ID_PATTERN,
			"status": "success"
		}))

		await listResources(`regionTasks/${taskId}/taskItems`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				taskItems: expectedTaskItems
			}
		}).toss()
	});
});


import { createResourcesMethodForModules } from "../utils/common.utils.js";
import {
	create_polygon_task_body_with_region_id,
	created_polygon_task_resource,
	POLYGON_TASKS_INTEGRATION_TEST_TAG_KEY,
	POLYGON_TASKS_INTEGRATION_TEST_TAG_VALUE
} from "./polygonTasks.data.js";
import { create_group_body } from "./groups.data.js";
import { getAuthToken } from "../utils/auth.js";
import { REGION_TASKS_INTEGRATION_TEST_TAG_KEY, REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE } from "./regionTasks.data.js";
import { afterEach, beforeEach, describe, test } from "vitest";
import { create_region_body } from "./regions.data.js";
import { ID_PATTERN } from "../utils/regex.js";

const { createResource, deleteResource, getResource, listResources, teardownResources, updateResource, waitForGetResource } = createResourcesMethodForModules('regions');

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[POLYGON_TASKS_INTEGRATION_TEST_TAG_KEY]: POLYGON_TASKS_INTEGRATION_TEST_TAG_VALUE,
};


const TEST_PREFIX = 'regions module (polygonTasks): ';
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

const createRegion = async (groupId: string, idToken: string): Promise<string> => {
	return await createResource(
		'regions',
		{
			withIdToken: idToken,
			expectStatus: 201,
			withJson: create_region_body,
			withTags: testTags,
		},
		'groups',
		groupId
	).returns('id');
};


const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await teardownResources('regions', REGION_TASKS_INTEGRATION_TEST_TAG_KEY, REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('groups', REGION_TASKS_INTEGRATION_TEST_TAG_KEY, REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE, idToken);
	const tasks = await listResources('polygonTasks', { withIdToken: idToken, expectJsonLike: {}, expectStatus: 200 }).returns('tasks');
	for (const task of tasks) {
		await deleteResource('polygonTasks', { id: task.id, withIdToken: idToken, expectStatus: 204 })
	}
};

describe(TEST_PREFIX + 'creating bulk tasks polygons', () => {
	let regionId: string;
	let userToken: string;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		regionId = await createRegion(groupId, userToken);
	});

	test('creating polygons in bulk - unspecified region id', async () => {
		await createResource(
			'polygonTasks',
			{
				withIdToken: userToken,
				withJson: create_polygon_task_body_with_region_id(undefined, testTags),
				withTags: testTags,
				expectStatus: 400,
			}
		).toss();

		// because the request fails on fastify schema validation, the tasks are not created yet
		await listResources(`polygonTasks`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				tasks: []
			}
		}).toss()
	});

	test('creating polygons in bulk - invalid group id', async () => {
		const createPolygonTaskRequest = create_polygon_task_body_with_region_id('invalidRegionId', testTags);
		const taskId = await createResource(
			'polygonTasks',
			{
				withIdToken: userToken,
				withJson: createPolygonTaskRequest,
				withTags: testTags,
				expectStatus: 201,
				expectJsonLike: created_polygon_task_resource(ADMIN_USERNAME, createPolygonTaskRequest['items'].length)
			}
		).returns('id');

		// unlikes the previous example, in this case the request has passed schema validation, it will create the tasks
		await listResources(`polygonTasks`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				tasks: [{
					"taskStatus": "inProgress",
					"id": ID_PATTERN,
					"taskType": "create",
				}]
			}
		}).toss()

		await waitForGetResource('polygonTasks', {
			expectStatus: 200,
			id: taskId,
			withIdToken: userToken,
			expectJsonLike: {
				id: taskId,
				taskStatus: 'success'
			}
		})

		const expectedTaskItems = createPolygonTaskRequest['items'].map(o => ({
			"name": o.name,
			"taskId": taskId,
			"status": "failure",
			"statusMessage": "Region 'invalidRegionId' not found."
		}))

		await listResources(`polygonTasks/${taskId}/taskItems`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				taskItems: expectedTaskItems
			}
		}).toss()
	});

	test('creating polygons in bulk - happy path', async () => {
		const createPolygonTaskRequest = create_polygon_task_body_with_region_id(regionId, testTags);
		const taskId = await createResource(
			'polygonTasks',
			{
				withIdToken: userToken,
				withJson: createPolygonTaskRequest,
				withTags: testTags,
				expectStatus: 201,
				expectJsonLike: created_polygon_task_resource(ADMIN_USERNAME, createPolygonTaskRequest['items'].length)
			}
		).returns('id');

		await listResources(`polygonTasks`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				tasks: [{
					"taskStatus": "inProgress",
					"id": taskId,
					"taskType": "create",
				}]
			}
		}).toss()

		await waitForGetResource('polygonTasks', {
			expectStatus: 200,
			id: taskId,
			withIdToken: userToken,
			expectJsonLike: {
				id: taskId,
				taskStatus: 'success'
			}
		})

		const expectedTaskItems = createPolygonTaskRequest['items'].map(o => ({
			"name": o.name,
			"taskId": taskId,
			"resourceId": ID_PATTERN,
			"status": "success"
		}))

		await listResources(`polygonTasks/${taskId}/taskItems`, {
			withIdToken: userToken,
			expectStatus: 200,
			expectJsonLike: {
				taskItems: expectedTaskItems
			}
		}).toss()
	});

	afterEach(async () => {
		await teardown();
	});

});


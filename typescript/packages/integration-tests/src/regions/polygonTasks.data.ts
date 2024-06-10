import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from "../utils/regex.js";

export const POLYGON_TASKS_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const POLYGON_TASKS_INTEGRATION_TEST_TAG_VALUE = 'regions-module-polygonTasks';

const testBoundary = [
	[
		92.2165561,
		79.9278869
	],
	[
		92.2187877,
		79.9275717
	],
	[
		92.2177792,
		79.9272602
	],
	[
		92.2154188,
		79.9274216
	],
	[
		92.2153974,
		79.9277556
	],
	[
		92.2165561,
		79.9278869
	]
]

export const create_polygon_task_body_with_region_id = (regionId: string, tags: Record<string, string>): object => {
	return {
		taskType: "create",
		items: [
			{
				regionId,
				"name": "test-polygon-1",
				"boundary": testBoundary
			},
			{
				regionId,
				"name": "test-polygon-2",
				"boundary": testBoundary
			},
			{
				regionId,
				"name": "test-polygon-3",
				"boundary": testBoundary
			},
			{
				regionId,
				"name": "test-polygon-4",
				"boundary": testBoundary
			},
			{
				regionId,
				"name": "test-polygon-5",
				"boundary": testBoundary
			},
			{
				regionId,
				"name": "test-polygon-6",
				"boundary": testBoundary
			}
		]
	}
}
export const created_polygon_task_resource = (username: string, itemsTotal: number): object => {
	return {
		"id": ID_PATTERN,
		"taskType": "create",
		"taskStatus": "waiting",
		"itemsTotal": itemsTotal,
		"itemsSucceeded": 0,
		"itemsFailed": 0,
		"createdAt": ISO8601_DATE_TIME_MS_PATTERN,
		"createdBy": username,
		"batchesTotal": 1,
		"batchesCompleted": 0
	}
}

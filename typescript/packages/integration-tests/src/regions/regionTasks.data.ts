import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from "../utils/regex.js";

export const REGION_TASKS_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const REGIONS_TASKS_INTEGRATION_TEST_TAG_VALUE = 'regions-module-regionTasks';
export const create_region_task_body_with_group_id = (groupId: string, tags: Record<string, string>): object => {
	return {
		taskType: "create",
		items: [
			{
				groupId,
				name: 'test-region-1',
				tags: {
					...tags,
				},
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-2',
				tags: {
					...tags,
				},
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-3',
				tags: {
					...tags,
				},
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-4',
				tags: {
					...tags,
				},
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-5',
				tags: {
					...tags,
				},
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-6',
				tags: {
					...tags,
				},
				processingConfig: {
					mode: 'disabled'
				}
			}
		]
	}
}
export const created_region_task_resource = (username: string, itemsTotal: number): object => {
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





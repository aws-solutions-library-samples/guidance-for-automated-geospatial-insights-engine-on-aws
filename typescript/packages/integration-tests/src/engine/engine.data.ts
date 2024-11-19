import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

export const ENGINE_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const ENGINE_INTEGRATION_TEST_TAG_VALUE = 'engine-module-resources';

export const create_execution_task_body = (regionId: string): object => {
	return {
		regionId: regionId,
		startDateTime: '2023-02-01T09:30:00.000Z',
		endDateTime: '2023-03-01T09:30:00.000Z',
		interval: {
			duration: 1,
			unit: 'month',
		},
	};
};

export const created_execution_task_resource = (username: string, regionId: string): object => {
	return {
		...create_execution_task_body(regionId),
		id: ID_PATTERN,
		createdAt: ISO8601_DATE_TIME_MS_PATTERN,
		createdBy: username,
		taskStatus: 'waiting',
	};
};

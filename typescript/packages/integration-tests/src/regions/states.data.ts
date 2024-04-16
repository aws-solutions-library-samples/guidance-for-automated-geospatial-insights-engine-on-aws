import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { JWT_EMAIL } from '../utils/auth.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

dayjs.extend(utc);

export const STATES_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const STATES_INTEGRATION_TEST_TAG_VALUE = 'regions-module-states';

export const create_state_body: object = {
	timestamp: dayjs().toISOString(),
	attributes: {
		estimatedYield: 1026,
	},
	tags: {
		plantedAt: dayjs('2024-03-15').toISOString(),
		crop: 'corn',
	},
};

export const created_state_resource: object = {
	id: ID_PATTERN,
	...create_state_body,
	createdAt: ISO8601_DATE_TIME_MS_PATTERN,
	createdBy: JWT_EMAIL,
};

export const update_state_body: object = {
	attributes: {
		estimatedYield: 1500,
	},
	tags: {
		harvestAt: dayjs('2024-04-21').toISOString(),
	},
};

export const updated_state_resource: object = {
	...created_state_resource,
	...update_state_body,
	updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
	updatedBy: JWT_EMAIL,
};

import { JWT_EMAIL } from '../utils/auth.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

export const ZONES_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const ZONES_INTEGRATION_TEST_TAG_VALUE = 'regions-module-zones';

export const create_zone_body: object = {
	name: 'test-zone-1',
	boundary: [
		[0, 0],
		[0, 10],
		[10, 10],
		[10, 0],
		[0, 0],
	],
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
};

export const created_zone_resource: object = {
	id: ID_PATTERN,
	...create_zone_body,
	createdAt: ISO8601_DATE_TIME_MS_PATTERN,
	createdBy: JWT_EMAIL,
};

export const update_zone_body: object = {
	name: 'test-zone-1-updated',
	boundary: [
		[0, 0],
		[0, 20],
		[20, 20],
		[20, 0],
		[0, 0],
	],
	attributes: {
		attr2: 'attr-two-updated',
	},
	tags: {
		tag2: 'tag-two-updated',
	},
};

export const updated_zone_resource: object = {
	...created_zone_resource,
	...update_zone_body,
	updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
	updatedBy: JWT_EMAIL,
};

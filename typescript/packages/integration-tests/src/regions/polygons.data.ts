import { JWT_EMAIL } from '../utils/auth.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

export const POLYGONS_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const POLYGONS_INTEGRATION_TEST_TAG_VALUE = 'regions-module-polygons';

export const create_polygon_body: object = {
	name: 'test-polygon-1',
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

export const created_polygon_resource: object = {
	id: ID_PATTERN,
	...create_polygon_body,
	createdAt: ISO8601_DATE_TIME_MS_PATTERN,
	createdBy: JWT_EMAIL,
};

export const update_polygon_body: object = {
	name: 'test-polygon-1-updated',
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

export const updated_polygon_resource: object = {
	...created_polygon_resource,
	...update_polygon_body,
	updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
	updatedBy: JWT_EMAIL,
};

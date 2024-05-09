import path from 'path';
import { initializeConfig } from '../utils/config.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

export const GROUPS_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const GROUPS_INTEGRATION_TEST_TAG_VALUE = 'regions-module-groups';

// load config from dotenv
initializeConfig(path.join(__dirname, '..', '..'));

export const create_group_body: object = {
	name: 'test-group-1',
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
};

export const created_group_resource = (username: string): object => {
	return {
		id: ID_PATTERN,
		...create_group_body,
		createdAt: ISO8601_DATE_TIME_MS_PATTERN,
		createdBy: username,
	};
};

export const update_group_body: object = {
	name: 'test-group-1-updated',
	attributes: {
		attr2: 'attr-two-updated',
	},
	tags: {
		tag2: 'tag-two-updated',
	},
};

export const updated_group_resource = (username: string): object => {
	return {
		...created_group_resource(username),
		...update_group_body,
		updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
		updatedBy: username,
	};
};

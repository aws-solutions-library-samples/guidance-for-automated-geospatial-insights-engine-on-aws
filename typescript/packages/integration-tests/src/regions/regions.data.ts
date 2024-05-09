import path from 'path';
import { initializeConfig } from '../utils/config.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

export const REGIONS_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const REGIONS_INTEGRATION_TEST_TAG_VALUE = 'regions-module-regions';

// load config from dotenv
initializeConfig(path.join(__dirname, '..', '..'));

export const create_region_body: object = {
	name: 'test-region-1',
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
};

export const created_region_resource = (username: string): object => {
	return {
		id: ID_PATTERN,
		...create_region_body,
		createdAt: ISO8601_DATE_TIME_MS_PATTERN,
		createdBy: username,
	};
};

export const update_region_body: object = {
	name: 'test-region-1-updated',
	attributes: {
		attr2: 'attr-two-updated',
	},
	tags: {
		tag2: 'tag-two-updated',
	},
};

export const updated_region_resource = (username: string): object => {
	return {
		...created_region_resource,
		...update_region_body,
		updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
		updatedBy: username,
	};
};

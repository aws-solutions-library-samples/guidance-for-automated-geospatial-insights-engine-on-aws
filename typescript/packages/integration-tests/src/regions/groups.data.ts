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

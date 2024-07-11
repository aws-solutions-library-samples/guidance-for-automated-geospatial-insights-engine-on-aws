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

import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN } from '../utils/regex.js';

export const POLYGONS_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const POLYGONS_INTEGRATION_TEST_TAG_VALUE = 'regions-module-polygons';

export const create_polygon_body: object = {
	name: 'test-polygon-1',
	boundary: [[[
		[0, 0],
		[0, 10],
		[10, 10],
		[10, 0],
		[0, 0],
	]]],
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
};

export const created_polygon_resource = (username: string): object => {
	return {
		id: ID_PATTERN,
		...create_polygon_body,
		createdAt: ISO8601_DATE_TIME_MS_PATTERN,
		createdBy: username,
	};
};

export const update_polygon_body: object = {
	name: 'test-polygon-1-updated',
	boundary: [[[
		[0, 0],
		[0, 20],
		[20, 20],
		[20, 0],
		[0, 0],
	]]],
	attributes: {
		attr2: 'attr-two-updated',
	},
	tags: {
		tag2: 'tag-two-updated',
	},
};

export const updated_polygon_resource = (username: string): object => {
	return {
		...created_polygon_resource,
		...update_polygon_body,
		updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
		updatedBy: username,
	};
};

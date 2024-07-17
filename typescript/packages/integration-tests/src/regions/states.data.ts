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

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
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

export const created_state_resource = (username: string): object => {
	return {
		id: ID_PATTERN,
		...create_state_body,
		createdAt: ISO8601_DATE_TIME_MS_PATTERN,
		createdBy: username,
	};
};

export const update_state_body: object = {
	attributes: {
		estimatedYield: 1500,
	},
	tags: {
		harvestAt: dayjs('2024-04-21').toISOString(),
	},
};

export const updated_state_resource = (username: string): object => {
	return {
		...created_state_resource,
		...update_state_body,
		updatedAt: ISO8601_DATE_TIME_MS_PATTERN,
		updatedBy: username,
	};
};

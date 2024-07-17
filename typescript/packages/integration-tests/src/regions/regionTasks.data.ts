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
				tags,
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-2',
				tags,
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-3',
				tags,
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-4',
				tags,
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-5',
				tags,
				processingConfig: {
					mode: 'disabled'
				}
			},
			{
				groupId,
				name: 'test-region-6',
				tags,
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





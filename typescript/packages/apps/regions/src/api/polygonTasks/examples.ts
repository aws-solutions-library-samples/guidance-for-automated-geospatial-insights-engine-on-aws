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

import { CreateTaskRequestBody, TaskList, TaskResource } from "../../common/tasks/schemas.js";


export const polygonTaskPostRequestExample: CreateTaskRequestBody = {
	items: [
		{
			name: 'Field 1',
			regionId: '01j035rmw8817a11j5vy6wgbsb',
			boundary: [
				[-104.5079674, 39.9194752],
				[-104.4894065, 39.9193435],
				[-104.4893912, 39.9122295],
				[-104.5078877, 39.9123941],
				[-104.5079674, 39.9194752],
			],
		},
		{
			name: 'Field 2',
			regionId: '01j035rmw8817a11j5vy6wgbsb',
			boundary: [
				[-104.5079674, 39.9194752],
				[-104.4894065, 39.9193435],
				[-104.4893912, 39.9122295],
				[-104.5078877, 39.9123941],
				[-104.5079674, 39.9194752],
			],
		}
	],
	taskType: "create"
}

export const polygonTaskListResourceExample: TaskList = {
	tasks: [{
		id: '01j035rmw8817a11j5vy6wgbsb',
		taskStatus: 'waiting',
		taskType: 'create',
		statusMessage: 'string',
		progress: 50,
		itemsTotal: 100,
		itemsSucceeded: 99,
		itemsFailed: 1,
		createdAt: '2022-08-30T03:18:26.809Z',
		createdBy: 'someone@somewhere',
	}]
}

export const polygonTaskResourceExample: TaskResource = {
	id: '01j035rmw8817a11j5vy6wgbsb',
	taskStatus: 'waiting',
	taskType: 'create',
	statusMessage: 'string',
	progress: 50,
	itemsTotal: 100,
	itemsSucceeded: 99,
	itemsFailed: 1,
	createdAt: '2022-08-30T03:18:26.809Z',
	createdBy: 'someone@somewhere',
}

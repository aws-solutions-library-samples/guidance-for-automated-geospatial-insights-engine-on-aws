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

import { TaskList, TaskNew, TaskResource } from './schemas.js';

export const executionTaskCreateRequestExample: TaskNew = {
	regionId: '01jb8zyt5ccs2zrq5c2vsmrx7a',
	startDateTime: '2023-02-01T09:30:00.000Z',
	endDateTime: '2023-03-01T09:30:00.000Z',
	interval: {
		duration: 1,
		unit: 'month',
	},
};

export const executionTaskResourceExample: TaskResource = {
	id: '01jbdqm00vdyz1d2bdbp26qm9p',
	taskStatus: 'success',
	regionId: '01jb8zyt5ccs2zrq5c2vsmrx7a',
	startDateTime: '2023-02-01T09:30:00.000Z',
	endDateTime: '2023-12-01T09:30:00.000Z',
	interval: {
		duration: 1,
		unit: 'month',
	},
	itemsTotal: 11,
	itemsSucceeded: 11,
	itemsFailed: 0,
	itemsCompleted: 11,
	createdAt: '2024-10-30T03:30:58.734Z',
	createdBy: 'someone@somewhere.com',
};

export const executionTaskResourceListExample: TaskList = {
	tasks: [executionTaskResourceExample],
};

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

import { TaskItemList, TaskItemResource } from './schemas.js';

export const taskItemResourceExample: TaskItemResource = {
	taskId: '01jbdv60dzd26j43wvn762ehm4',
	regionId: '01jb8zyt5ccs2zrq5c2vsmrx7a',
	startDateTime: '2023-02-01T09:30:00.000Z',
	resultId: '01jbdv61hs51zgm9fmgn3btwxk',
	status: 'success',
	statusMessage: 'Essential container in task exited',
};

export const executionTaskItemResourceList: TaskItemList = {
	taskItems: [
		{
			taskId: '01jbdv60dzd26j43wvn762ehm4',
			regionId: '01jb8zyt5ccs2zrq5c2vsmrx7a',
			startDateTime: '2023-02-01T09:30:00.000Z',
			resultId: '01jbdv61hs51zgm9fmgn3btwxk',
			status: 'success',
			statusMessage: 'Essential container in task exited',
		},
		{
			taskId: '01jbdv60dzd26j43wvn762ehm4',
			regionId: '01jb8zyt5ccs2zrq5c2vsmrx7a',
			startDateTime: '2023-03-01T09:30:00.000Z',
			resultId: '01jbdv62gb65grk28vmvz6yxsc',
			status: 'success',
			statusMessage: 'Essential container in task exited',
		},
	],
};

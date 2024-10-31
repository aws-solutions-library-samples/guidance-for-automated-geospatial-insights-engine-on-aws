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

import { createdAt, createdBy, stringEnum, updatedAt, updatedBy } from '@agie/resource-api-base';
import { Static, Type } from '@sinclair/typebox';
import { endDateTime, regionId, startDateTime } from '../common/schemas.js';

export const id = Type.String({ description: 'Task resource id.' });

const taskStatus = stringEnum(['waiting', 'inProgress', 'success', 'failure'], 'Task execution status');

const interval = Type.Object({
	duration: Type.Number({ description: `The numeric value that specifies how many units (days, weeks, or months) make up the interval period` }),
	unit: stringEnum(['day', 'week', 'month'], '`The unit of time used to measure the duration, such day, week or month`'),
});

export const taskNew = Type.Object(
	{
		regionId,
		startDateTime,
		endDateTime,
		interval,
	},
	{ $id: 'executionTask_new' }
);

const fromTaskIdPagination = Type.Optional(Type.String({ description: 'Last evaluated task Id' }));

export const taskResource = Type.Object(
	{
		id,
		taskStatus,
		regionId,
		interval,
		startDateTime,
		endDateTime,
		createdAt,
		createdBy,
		statusMessage: Type.Optional(Type.String({ description: 'message for the status' })),
		progress: Type.Optional(Type.Number({ description: 'total progress of the task' })),
		itemsTotal: Type.Number({ description: 'total number of items in the task' }),
		itemsSucceeded: Type.Number({ description: 'total number of items succeeded' }),
		itemsFailed: Type.Number({ description: 'no. of items failed' }),
		itemsCompleted: Type.Number({ description: 'no. of items completed' }),
		updatedAt: Type.Optional(updatedAt),
		updatedBy: Type.Optional(updatedBy),
	},
	{
		$id: 'Task_resource',
	}
);

export const taskList = Type.Object(
	{
		tasks: Type.Array(Type.Ref(taskResource)),
		pagination: Type.Optional(
			Type.Object({
				lastEvaluated: Type.Optional(fromTaskIdPagination),
			})
		),
	},
	{
		$id: 'executionTasks_list',
	}
);

export type TaskResource = Static<typeof taskResource>;
export type TaskList = Static<typeof taskList>;
export type TaskNew = Static<typeof taskNew>;

export interface TaskBatchProgress {
	taskId: string;
	itemsFailed: number;
	itemsSucceeded: number;
}

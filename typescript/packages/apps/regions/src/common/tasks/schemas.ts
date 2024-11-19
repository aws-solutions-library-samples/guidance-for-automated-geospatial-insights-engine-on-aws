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

import { SecurityContext } from '@agie/rest-api-authorizer';
import { Static, Type } from '@sinclair/typebox';
import { createPolygonRequestBody, editPolygonRequestBody } from '../../api/polygons/schemas.js';
import { createRegionRequestBody, editRegionRequestBody } from '../../api/regions/schemas.js';
import { createdAt, createdBy, groupId, paginationToken, polygonId, polygonTaskId, regionId, updatedAt, updatedBy } from '../../common/schemas.js';
import { stringEnum } from '../../common/types.js';

const taskStatus = stringEnum(['waiting', 'inProgress', 'success', 'failure'], 'Task execution status');

const taskType = stringEnum(['create', 'update'], 'Task type');

export const createPolygonRequestWithRegionIdBody = Type.Intersect([createPolygonRequestBody, Type.Object({ regionId: regionId })], {
	$id: 'createPolygonRequestWithRegionIdBody',
});

export const editPolygonRequestWithIdBody = Type.Intersect([editPolygonRequestBody, Type.Object({ id: polygonId })], { $id: 'editPolygonRequestWithIdBody' });

export const createRegionRequestWithGroupIdBody = Type.Intersect([createRegionRequestBody, Type.Object({ groupId: groupId })], { $id: 'createRegionRequestWithGroupIdBody' });

export const editRegionRequestWithIdBody = Type.Intersect([editRegionRequestBody, Type.Object({ id: regionId })], { $id: 'editRegionRequestWithIdBody' });

export const createTaskRequestBody = Type.Object(
	{
		// the schema for item in the array will be check by validation method for each resource task, e.g. RegionTaskService validates create/update region request
		items: Type.Array(Type.Any()),
		taskType,
	},
	{
		$id: 'createTaskRequestBody',
	}
);

export const taskResource = Type.Object(
	{
		id: polygonTaskId,
		taskType,
		taskStatus,
		statusMessage: Type.Optional(Type.String({ description: 'message for the status' })),
		progress: Type.Optional(Type.Number({ description: 'total progress of the task' })),
		batchesTotal: Type.Optional(Type.Number({ description: 'no. of batches the task has been split into' })),
		batchesCompleted: Type.Optional(Type.Number({ description: 'no. of batches the task which have been completed' })),
		itemsTotal: Type.Number({ description: 'total number of items in the task' }),
		itemsSucceeded: Type.Number({ description: 'total number of items succeeded' }),
		itemsFailed: Type.Number({ description: 'no. of items failed' }),
		createdAt,
		createdBy,
		updatedAt: Type.Optional(updatedAt),
		updatedBy: Type.Optional(updatedBy),
	},
	{
		$id: 'taskResource',
	}
);

export const taskList = Type.Object(
	{
		tasks: Type.Array(Type.Ref(taskResource)),
		pagination: Type.Optional(
			Type.Object({
				token: Type.Optional(paginationToken),
				count: Type.Number(),
			})
		),
	},
	{
		$id: 'taskList',
	}
);

export type TaskResource = Static<typeof taskResource>;
export type TaskList = Static<typeof taskList>;
export type CreateTaskRequestBody = Static<typeof createTaskRequestBody>;
export type CreatePolygonRequestWithRegionIdBody = Static<typeof createPolygonRequestWithRegionIdBody>;
export type EditPolygonRequestWithIdBody = Static<typeof editPolygonRequestWithIdBody>;
export type CreateRegionRequestWithGroupIdBody = Static<typeof createRegionRequestWithGroupIdBody>;
export type EditRegionRequestWithIdBody = Static<typeof editRegionRequestWithIdBody>;

export interface TaskBatchProgress {
	taskId: string;
	totalItems: number;
	itemsFailed: number;
	itemsSucceeded: number;
}

export interface TaskBatch {
	taskId: string;
	securityContext: SecurityContext;
	type: Static<typeof taskType>;
	items: CreatePolygonRequestWithRegionIdBody[] | EditPolygonRequestWithIdBody[] | CreateRegionRequestWithGroupIdBody[] | EditRegionRequestWithIdBody[];
}

export type ResourceType = 'Polygon' | 'Region';

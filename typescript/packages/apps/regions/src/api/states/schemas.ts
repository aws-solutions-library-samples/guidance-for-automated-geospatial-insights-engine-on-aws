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

import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, groupId, paginationToken, regionId, stateId, tags, updatedAt, updatedBy, polygonId } from '../../common/schemas.js';

/**
 * State specific path parameters
 */

/**
 * State specific query string parameters
 */
export const latestStateOnlyQS = Type.Optional(Type.Boolean({ description: 'Returns latest state only.', default: true }));

/**
 * State specific resource parameters
 */
export const timestamp = Type.String({
	description: 'Date/time created',
	format: 'date-time',
});

/**
 * State specific resources
 */

export const createStateRequestBody = Type.Object(
	{
		timestamp,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createStateRequestBody' }
);
export type CreateState = Static<typeof createStateRequestBody>;

export const editStateRequestBody = Type.Object(
	{
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editStateRequestBody' }
);
export type EditState = Static<typeof editStateRequestBody>;

export const stateResource = Type.Object(
	{
		id: stateId,
		polygonId,
		regionId,
		groupId,
		timestamp,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
		createdBy: createdBy,
		createdAt: createdAt,
		updatedBy: Type.Optional(updatedBy),
		updatedAt: Type.Optional(updatedAt),
	},
	{ $id: 'stateResource' }
);
export type State = Static<typeof stateResource>;

export const stateList = Type.Object(
	{
		states: Type.Array(Type.Ref(stateResource)),
		pagination: Type.Optional(
			Type.Object({
				token: Type.Optional(paginationToken),
				count: Type.Number(),
			})
		),
	},
	{ $id: 'stateList' }
);
export type StateList = Static<typeof stateList>;

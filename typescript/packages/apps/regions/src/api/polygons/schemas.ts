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
import { attributes, createdAt, createdBy, groupId, paginationToken, polygonId, regionId, tags, updatedAt, updatedBy } from '../../common/schemas.js';
import { stateResource } from '../states/schemas.js';

/**
 * Polygon specific path parameters
 */

/**
 * Polygon specific query string parameters
 */
export const includeLatestStateQS = Type.Optional(Type.Boolean({ description: 'Include latest state in results.', default: false }));

/**
 * Polygon specific resource parameters
 */
const name = Type.String({ description: 'The name of the Polygon.' });
const area = Type.Number({ description: 'The area of the Polygon.' });
export const polygonCoordinates = Type.Array(Type.Array(Type.Array(Type.Tuple([Type.Number({ description: 'Latitude' }), Type.Number({ description: 'Longitude' })]))), {
	$id: 'polygon',
	description: 'Coordinates defining a polygon.',
});
export type PolygonCoordinates = Static<typeof polygonCoordinates>;

const boundary = Type.Ref(polygonCoordinates, { description: 'The boundary of the Polygon.' });

const exclusions = Type.Array(Type.Ref(polygonCoordinates), { description: 'Boundaries to be excluded from the Polygon.' });

/**
 * Polygon specific resources
 */

export const createPolygonRequestBody = Type.Object(
	{
		name,
		boundary,
		exclusions: Type.Optional(exclusions),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createPolygonRequestBody' }
);
export type CreatePolygon = Static<typeof createPolygonRequestBody>;

export const editPolygonRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		boundary: Type.Optional(boundary),
		exclusions: Type.Optional(exclusions),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editPolygonRequestBody' }
);
export type EditPolygon = Static<typeof editPolygonRequestBody>;
export const polygonResource = Type.Object(
	{
		id: polygonId,
		name,
		regionId,
		groupId,
		boundary,
		exclusions: Type.Optional(exclusions),
		area,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
		state: Type.Optional(Type.Ref(stateResource)),
		createdBy: createdBy,
		createdAt: createdAt,
		updatedBy: Type.Optional(updatedBy),
		updatedAt: Type.Optional(updatedAt),
	},
	{ $id: 'polygonResource' }
);
export type Polygon = Static<typeof polygonResource>;

export const polygonList = Type.Object(
	{
		polygons: Type.Array(Type.Ref(polygonResource)),
		pagination: Type.Optional(
			Type.Object({
				token: Type.Optional(paginationToken),
				count: Type.Number(),
			})
		),
	},
	{ $id: 'polygonList' }
);
export type PolygonList = Static<typeof polygonList>;

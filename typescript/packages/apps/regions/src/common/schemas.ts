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

/* eslint-disable @rushstack/typedef-var */
import { Static, Type } from '@sinclair/typebox';
import { Nullable, apiVersion100 } from './types.js';

/**
 * Common path parameters
 */

/**
 * Common query string parameters
 */

export const groupIdQS = Type.Optional(Type.String({ description: 'Group ID to filter by.' }));
export const regionIdQS = Type.Optional(Type.String({ description: 'Region ID to filter by.' }));
export const zoneIdQS = Type.Optional(Type.String({ description: 'Zone ID to filter by.' }));

export const countPaginationQS = Type.Optional(Type.Integer({ description: 'Count of results to return.' }));
export const fromIdPaginationQS = Type.Optional(Type.String({ description: 'Id to paginate from (exclusive).' }));
export const fromTokenPaginationQS = Type.Optional(Type.String({ description: 'Token used to paginate from (exclusive).' }));
export const nextTokenPaginationQS = Type.Optional(Type.String({ description: 'Pagination token.' }));
export const nameQS = Type.Optional(Type.String({ description: 'Name to filter by.' }));
export const tagFilterQS = Type.Optional(Type.Array(Type.String({ description: 'Tag key and value in the format of `key:value`.' }), { description: 'Tag keys and values to filter by.' }));

/**
 * Common resource parameters
 */
export const groupId = Type.String({ description: 'Unique Group ID.' });
export const regionId = Type.String({ description: 'Unique Region ID.' });
export const zoneId = Type.String({ description: 'Unique Zone ID.' });
export const stateId = Type.String({ description: 'Unique State ID.' });

export const createdBy = Type.String({ description: 'ID of owner.' });
export const createdAt = Type.String({
	description: 'Date/time created',
	format: 'date-time',
});
export const updatedBy = Type.String({ description: 'Last ID of user who made a change.' });
export const updatedAt = Type.String({
	description: 'Date/time updated',
	format: 'date-time',
});

export const paginationToken = Type.String({ description: 'Token used to paginate to the next page of search result.' });

export const nextToken = Type.Optional(
	Type.String({
		description: 'Pagination token',
	})
);

export const tags = Type.Record(Type.String(), Nullable(Type.String()), {
	$id: 'tags',
	description: 'User-defined searchable tags',
});
export type Tags = Static<typeof tags>;

export const attributes = Type.Record(Type.String(), Type.Any(), {
	$id: 'attributes',
	description: 'any non-searchable or filterable key:val attributes to specify metadata such as label, description etc.',
});
export type Attributes = Static<typeof attributes>;

/**
 * Common headers
 */
export const commonHeaders = Type.Object({
	'accept-version': Type.String({ description: 'API version', default: apiVersion100 }),
	accept: Type.String({ description: 'Accepted Content Type', default: 'application/json' }),
});

/**
 * Common responses
 */
export const notFoundResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'notFoundResponse', description: 'Not found.' }
);

export const updatedResponse = Type.Object({}, { $id: 'updatedResponse', description: 'Updated successfully.' });

export const deletedResponse = Type.Object({}, { $id: 'deletedResponse', description: 'Deleted successfully.' });

export const badRequestResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'badRequestResponse', description: 'Bad request.' }
);

export const notImplementedResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'notImplementedResponse', description: 'Not implemented.' }
);

export const forbiddenResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'forbiddenResponse', description: 'Forbidden.' }
);

export const conflictResponse = Type.Object(
	{
		message: Type.String(),
		syntaxErrors: Type.Optional(
			Type.Object({
				charPositionInLine: Type.Integer(),
				line: Type.Integer(),
				msg: Type.String(),
			})
		),
	},
	{ $id: 'conflictResponse', description: 'Conflict.' }
);

export const noBodyResponse = Type.Object({}, { $id: 'noBodyResponse', description: 'Success.' });

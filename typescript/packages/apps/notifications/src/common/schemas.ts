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

import { Type } from "@sinclair/typebox";
import { apiVersion100 } from "./types.js";

/**
 * Common headers
 */
export const commonHeaders = Type.Object({
	'accept-version': Type.String({ description: 'API version', default: apiVersion100 }),
	accept: Type.String({ description: 'Accepted Content Type', default: 'application/json' }),
});

export const countPaginationQS = Type.Integer({ description: 'Count of results to return, if not specified default to 20', default: 20 });
export const fromIdPaginationQS = Type.Optional(Type.String({ description: 'Id to paginate from (exclusive).' }));
export const fromTokenPaginationQS = Type.Optional(Type.String({ description: 'Token used to paginate from (exclusive).' }));
export const paginationToken = Type.String({ description: 'Token used to paginate to the next page of search result.' });

export const badRequestResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'badRequestResponse', description: 'Bad request.' }
);

export const forbiddenResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'forbiddenResponse', description: 'Forbidden.' }
);

export const notFoundResponse = Type.Object(
	{
		message: Type.String(),
	},
	{ $id: 'notFoundResponse', description: 'Not found.' }
);

export const noBodyResponse = Type.Object({}, { $id: 'noBodyResponse', description: 'Success.' });

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

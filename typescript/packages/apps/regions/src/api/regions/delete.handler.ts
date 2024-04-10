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

import { Type } from '@sinclair/typebox';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { commonHeaders, forbiddenResponse, regionId, noBodyResponse, notFoundResponse } from '../../common/schemas.js';
import { atLeastAdmin } from '../../common/scopes.js';

export default function deleteRegionRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'DELETE',
		url: '/regions/:regionId',

		schema: {
			summary: 'Deletes a region.',
			description: `Deletes a region.

Permissions:
- Only \`admin\` and above may delete regions.
`,
			tags: ['Regions'],
			operationId: 'deleteRegion',
			headers: commonHeaders,
			params: Type.Object({
				regionId: regionId,
			}),
			response: {
				204: noBodyResponse,
				403: forbiddenResponse,
				404: notFoundResponse,
			},
			'x-security-scopes': atLeastAdmin,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			// TODO
		},
	});

	done();
}

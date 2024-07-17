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
import { commonHeaders, forbiddenResponse, noBodyResponse, notFoundResponse, polygonId } from '../../common/schemas.js';
import { atLeastAdmin } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';

export default function deletePolygonRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'DELETE',
		url: '/polygons/:polygonId',

		schema: {
			summary: 'Deletes a polygon.',
			description: `Deletes a polygon.

Permissions:
- Only \`admin\` and above may delete polygons.
`,
			tags: ['Polygons'],
			operationId: 'deletePolygon',
			headers: commonHeaders,
			params: Type.Object({
				polygonId: polygonId,
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
			const svc = fastify.diContainer.resolve('polygonService');
			const { polygonId } = request.params;
			await svc.delete(request.authz, polygonId);
			return reply.status(204).send();
		},
	});

	done();
}

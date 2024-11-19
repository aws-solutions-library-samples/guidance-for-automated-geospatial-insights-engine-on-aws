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

import { atLeastReader } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { commonHeaders, notFoundResponse, polygonId } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { polygonResourceExample1 } from './example.js';
import { polygonResource } from './schemas.js';

export default function getPolygonRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/polygons/:polygonId',

		schema: {
			summary: 'Retrieve a polygon.',
			description: `Retrieve the details of a polygon.

Permissions:
- Only \`reader\` and above may view polygons.
`,
			tags: ['Polygons'],
			operationId: 'getPolygon',
			headers: commonHeaders,
			params: Type.Object({
				polygonId: polygonId,
			}),
			response: {
				200: {
					description: 'Success.',
					...polygonResource,
					'x-examples': {
						'Existing polygon': {
							summary: 'Polygon retrieved successfully.',
							value: polygonResourceExample1,
						},
					},
				},
				404: notFoundResponse,
			},
			'x-security-scopes': atLeastReader,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc = fastify.diContainer.resolve('polygonService');
			const { polygonId } = request.params;
			const polygon = await svc.get(request.authz, polygonId);
			return reply.status(200).send(polygon);
		},
	});

	done();
}

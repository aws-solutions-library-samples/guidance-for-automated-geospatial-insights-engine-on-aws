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

import { atLeastContributor } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { badRequestResponse, commonHeaders, conflictResponse, forbiddenResponse, notFoundResponse, polygonId } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { polygonPatchRequestExample1, polygonPatchRequestExample2, polygonResourceExample2 } from './example.js';
import { editPolygonRequestBody, polygonResource } from './schemas.js';

export default function updatePolygonRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'PATCH',
		url: '/polygons/:polygonId',

		schema: {
			summary: 'Update a polygon.',
			description: `Update an existing polygon.

Permissions:
- Only \`admins\` may update polygons.
`,
			tags: ['Polygons'],
			operationId: 'updatePolygon',
			headers: commonHeaders,
			params: Type.Object({
				polygonId: polygonId,
			}),
			body: {
				...Type.Ref(editPolygonRequestBody),
				'x-examples': {
					'Update polygon': {
						summary: 'Update an existing polygon.',
						value: polygonPatchRequestExample1,
					},
					'Changing tags': {
						summary: 'Changing the tags of a polygon.',
						value: polygonPatchRequestExample2,
					},
				},
			},
			response: {
				200: {
					description: 'Success.',
					...polygonResource,
					'x-examples': {
						'Existing polygon updated successfully': {
							summary: 'Existing polygon created successfully.',
							value: polygonResourceExample2,
						},
					},
				},
				400: {
					...badRequestResponse,
					'x-examples': {
						'Invalid request': {
							summary: 'Invalid request.',
							value: {
								description: 'Expected `formula` to be defined but not provided.',
							},
						},
					},
				},
				403: forbiddenResponse,
				404: notFoundResponse,
				409: {
					...conflictResponse,
					'x-examples': {
						'Name in use': {
							summary: 'The `name` is already in use.',
							value: {
								description: 'Name `xyz` already exists.',
							},
						},
					},
				},
			},
			'x-security-scopes': atLeastContributor,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc = fastify.diContainer.resolve('polygonService');
			const { polygonId } = request.params;
			const saved = await svc.update(request.authz, polygonId, request.body);
			return reply.status(200).send(saved);
		},
	});

	done();
}

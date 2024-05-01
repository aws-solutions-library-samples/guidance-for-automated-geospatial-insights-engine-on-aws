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
import { badRequestResponse, commonHeaders, conflictResponse, regionId } from '../../common/schemas.js';
import { atLeastContributor } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { polygonPostRequestExample, polygonResourceExample1 } from './example.js';
import { createPolygonRequestBody, polygonResource } from './schemas.js';

export default function createPolygonRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/regions/:regionId/polygons',

		schema: {
			summary: 'Define a new polygon',
			description: `Define a new polygon.

Permissions:
- Only \`admin\` and above may create new polygons.
`,
			tags: ['Polygons'],
			headers: commonHeaders,
			operationId: 'createPolygon',
			params: Type.Object({
				regionId: regionId,
			}),
			body: {
				...Type.Ref(createPolygonRequestBody),
				'x-examples': {
					'New polygon': {
						summary: 'Create a new polygon.',
						value: polygonPostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...polygonResource,
					'x-examples': {
						'New polygon': {
							summary: 'New polygon created successfully.',
							value: polygonResourceExample1,
						},
					},
				},
				400: {
					...badRequestResponse,
					'x-examples': {
						'Invalid request': {
							summary: 'Invalid request.',
							value: {
								description: 'Expected `name` to be defined but not provided.',
							},
						},
					},
				},
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
			const { regionId } = request.params;
			const saved = await svc.create(request.authz, regionId, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved);
		},
	});

	done();
}

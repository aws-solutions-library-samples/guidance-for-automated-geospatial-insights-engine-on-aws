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
import { badRequestResponse, commonHeaders, conflictResponse, polygonId } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { statePostRequestExample, stateResourceExample1 } from './example.js';
import { createStateRequestBody, stateResource } from './schemas.js';

export default function createStateRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/polygons/:polygonId/states',

		schema: {
			summary: 'Define a new state',
			description: `Define a new state of a polygon.

Permissions:
- Only \`admin\` and above may create new states.
`,
			tags: ['States'],
			headers: commonHeaders,
			operationId: 'createState',
			params: Type.Object({
				polygonId: polygonId,
			}),
			body: {
				...Type.Ref(createStateRequestBody),
				'x-examples': {
					'New state': {
						summary: 'Create a new state.',
						value: statePostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...stateResource,
					'x-examples': {
						'New state': {
							summary: 'New state created successfully.',
							value: stateResourceExample1,
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
			const svc = fastify.diContainer.resolve('stateService');
			const { polygonId } = request.params;
			const saved = await svc.create(request.authz, polygonId, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved);
		},
	});

	done();
}

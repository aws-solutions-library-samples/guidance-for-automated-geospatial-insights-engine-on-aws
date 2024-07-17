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
import { badRequestResponse, commonHeaders } from '../../common/schemas.js';
import { atLeastContributor } from '../../common/scopes.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { polygonTaskPostRequestExample, polygonTaskResourceExample } from "./examples.js";
import { createTaskRequestBody, taskResource } from "../../common/tasks/schemas.js";

export default function createPolygonTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/polygonTasks',

		schema: {
			summary: 'Start a task to create polygon in bulk.',
			description: `The endpoint allows user to create polygon resource in bulk. Typically used when performing bulk import of resources from external sources such as file.

Permissions:
- Only \`contributor\` and above may create new polygon tasks.
`,
			tags: ['PolygonTasks'],
			headers: commonHeaders,
			operationId: 'createPolygonTask',
			body: {
				...Type.Ref(createTaskRequestBody),
				'x-examples': {
					'New polygon task': {
						summary: 'Create a new polygon task.',
						value: polygonTaskPostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...taskResource,
					'x-examples': {
						'New polygon task': {
							summary: 'New polygon task created successfully.',
							value: polygonTaskResourceExample,
						},
					},
				},
				400: {
					...badRequestResponse,
					'x-examples': {
						'Invalid request': {
							summary: 'Invalid request.',
							value: {
								description: 'Expected array to not be empty.',
							},
						},
					},
				}
			},
			'x-security-scopes': atLeastContributor,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc = fastify.diContainer.resolve('polygonTaskService');
			const saved = await svc.create(request.authz, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved);
		},
	});

	done();
}

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
import { badRequestResponse, commonHeaders } from '../../common/schemas.js';
import { createTaskRequestBody, taskResource } from '../../common/tasks/schemas.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { regionTaskPostRequestExample, regionTaskResourceExample } from './examples.js';

export default function createRegionTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/regionTasks',

		schema: {
			summary: 'Start a task to create region in bulk.',
			description: `The endpoint allows user to create region resource in bulk. Typically used when performing bulk import of resources from external sources such as file.

Permissions:
- Only \`admin\` and above may create new region tasks.
`,
			tags: ['RegionTasks'],
			headers: commonHeaders,
			operationId: 'createRegionTask',
			body: {
				...Type.Ref(createTaskRequestBody),
				'x-examples': {
					'New region task': {
						summary: 'Create a new region task.',
						value: regionTaskPostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...taskResource,
					'x-examples': {
						'New region task': {
							summary: 'New region task created successfully.',
							value: regionTaskResourceExample,
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
				},
			},
			'x-security-scopes': atLeastContributor,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc = fastify.diContainer.resolve('regionTaskService');
			const saved = await svc.create(request.authz, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved);
		},
	});

	done();
}

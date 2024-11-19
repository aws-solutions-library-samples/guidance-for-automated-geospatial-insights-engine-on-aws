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

import { apiVersion100, badRequestResponse, commonHeaders, FastifyTypebox } from '@agie/resource-api-base';
import { atLeastContributor } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { executionTaskCreateRequestExample, executionTaskResourceExample } from './examples.js';
import { taskNew, taskResource } from './schemas.js';
import { ExecutionTaskService } from './service.js';

export default function createExecutionTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/executionTasks',
		schema: {
			description: `Create a execution tasks in bulk`,
			headers: commonHeaders,
			tags: ['Execution Tasks'],
			body: {
				...Type.Ref(taskNew),
				'x-examples': {
					'new execution task request': {
						value: executionTaskCreateRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...Type.Ref(taskResource),
					'x-examples': {
						'Execution creation task': {
							summary: 'Existing execution task detail.',
							value: executionTaskResourceExample,
						},
					},
				},
				400: badRequestResponse,
			},
			'x-security-scopes': atLeastContributor,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc: ExecutionTaskService = fastify.diContainer.resolve('executionTaskService');
			const saved = await svc.create(request.authz, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved); // nosemgrep
		},
	});

	done();
}

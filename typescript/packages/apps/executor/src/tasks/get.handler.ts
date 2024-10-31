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

import { apiVersion100, FastifyTypebox, forbiddenResponse, id, notFoundResponse } from '@agie/resource-api-base';
import { Type } from '@sinclair/typebox';
import { atLeastReader } from '../common/scopes.js';
import { executionTaskResourceExample } from './examples.js';
import { taskResource } from './schemas.js';
import { ExecutionTaskService } from './service.js';

export default function getExecutionTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/executionTasks/:id',

		schema: {
			description: `Retrieve details of an existing execution task`,
			tags: ['Execution Tasks'],
			params: Type.Object({
				id,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskResource),
					'x-examples': {
						'Existing Execution Task': {
							summary: 'Existing Execution Task details.',
							value: executionTaskResourceExample,
						},
					},
				},
				403: forbiddenResponse,
				404: notFoundResponse,
			},
			'x-security-scopes': atLeastReader,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc: ExecutionTaskService = fastify.diContainer.resolve('executionTaskService');
			const { id } = request.params;
			const saved = await svc.get(request.authz, id);
			return reply.status(200).send(saved); // nosemgrep
		},
	});

	done();
}

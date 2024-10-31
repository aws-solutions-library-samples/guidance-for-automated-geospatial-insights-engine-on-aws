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

import { apiVersion100, countPaginationQS, FastifyTypebox, fromTokenPaginationQS } from '@agie/resource-api-base';
import { Type } from '@sinclair/typebox';
import { atLeastReader } from '../common/scopes.js';
import { executionTaskResourceListExample } from './examples.js';
import { TaskList, taskList } from './schemas.js';
import { ExecutionTaskService } from './service.js';

export default function listExecutionTasksRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/executionTasks',
		schema: {
			description: `Lists Execution Tasks`,
			tags: ['Execution Tasks'],
			querystring: Type.Object({
				count: countPaginationQS,
				fromTaskId: fromTokenPaginationQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskList),
					'x-examples': {
						'List of Execution Tasks': {
							summary: 'Paginated list of executionTasks',
							value: executionTaskResourceListExample,
						},
					},
				},
			},
			'x-security-scopes': atLeastReader,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc: ExecutionTaskService = fastify.diContainer.resolve('executionTaskService');

			// parse request
			const { count, fromTaskId: fromToken } = request.query;

			const [tasks, lastEvaluatedToken] = await svc.list(request.authz, {
				count,
				token: fromToken,
			});
			const response: TaskList = { tasks };

			if (count || lastEvaluatedToken) {
				response.pagination = {};
				if (lastEvaluatedToken) {
					response.pagination.lastEvaluated = lastEvaluatedToken;
				}
			}

			fastify.log.debug(`list.handler> exit:${JSON.stringify(response)}`);
			await reply.status(200).send(response); // nosemgrep
		},
	});

	done();
}

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

import { apiVersion100, commonHeaders, countPaginationQS, FastifyTypebox, fromIdPaginationQS } from '@agie/resource-api-base';
import { Type } from '@sinclair/typebox';

import { atLeastReader } from '@agie/rest-api-authorizer';
import { executionTaskItemResourceList } from './example.js';
import { taskId, taskItemList, TaskItemList } from './schemas.js';

export default function listExecutionTaskItemRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/executionTasks/:taskId/taskItems',
		schema: {
			description: `Lists execution task items`,
			tags: ['Task Items'],
			operationId: 'listExecutionTaskItems',
			headers: commonHeaders,
			params: Type.Object({
				taskId,
			}),
			querystring: Type.Object({
				count: countPaginationQS,
				fromDate: fromIdPaginationQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskItemList),
					'x-examples': {
						'List of task items': {
							summary: 'Paginated list of execution task items',
							value: executionTaskItemResourceList,
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
			const svc = fastify.diContainer.resolve('executionTaskItemService');

			// parse request
			const { count, fromDate } = request.query;
			const { taskId } = request.params;

			const [taskItems, lastEvaluatedId] = await svc.list(request.authz, taskId, {
				count,
				token: fromDate,
			});
			const response: TaskItemList = { taskItems: taskItems };
			if (count || lastEvaluatedId) {
				response.pagination = {};
				if (count) {
					response.pagination.count = count;
				}
				if (lastEvaluatedId) {
					response.pagination.lastEvaluatedId = lastEvaluatedId;
				}
			}

			fastify.log.debug(`list.handler> exit:${JSON.stringify(response)}`);
			await reply.status(200).send(response); // nosemgrep
		},
	});

	done();
}

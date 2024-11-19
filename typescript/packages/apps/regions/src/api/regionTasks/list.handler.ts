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
import { commonHeaders, countPaginationQS, fromTokenPaginationQS } from '../../common/schemas.js';
import { TaskList, taskList } from '../../common/tasks/schemas.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { regionTaskListResourceExample } from './examples.js';

export default function listRegionTasksRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/regionTasks',

		schema: {
			summary: 'List all region tasks.',
			description: `List all region tasks.

Permissions:
- \`readers\` may list region tasks.
`,
			tags: ['Region Tasks'],
			operationId: 'listRegionTasks',
			headers: commonHeaders,
			querystring: Type.Object({
				count: countPaginationQS,
				paginationToken: fromTokenPaginationQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...taskList,
					'x-examples': {
						'List of regions': {
							summary: 'Paginated list of regions.',
							value: regionTaskListResourceExample,
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
			const svc = fastify.diContainer.resolve('regionTaskService');

			// parse request
			const { count, paginationToken } = request.query;
			const [tasks, nextToken] = await svc.list(request.authz, {
				count,
				token: paginationToken,
			});

			const response: TaskList = { tasks };
			if (count || nextToken) {
				response.pagination = {
					token: nextToken,
					count,
				};
			}

			fastify.log.debug(`list.handler> exit:${JSON.stringify(response)}`);
			await reply.status(200).send(response); // nosemgrep
		},
	});

	done();
}

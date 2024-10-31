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

import { apiVersion100, FastifyTypebox, forbiddenResponse, notFoundResponse } from '@agie/resource-api-base';

import { startDateTime } from '../common/schemas.js';
import { atLeastReader } from '../common/scopes.js';
import { taskItemResourceExample } from './example.js';
import { taskId, taskItemResource } from './schemas.js';

export default function getTaskItemRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/executionTasks/:taskId/taskItems/:startDateTime',

		schema: {
			description: `Retrieve details of an execution task item in an execution task`,
			tags: ['Task Item'],
			params: Type.Object({
				taskId,
				startDateTime,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskItemResource),
					'x-examples': {
						'Existing Execution Task Item': {
							summary: 'Execution Task Item Details',
							value: taskItemResourceExample,
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
			const svc = fastify.diContainer.resolve('executionTaskItemService');
			const { taskId, startDateTime } = request.params;
			const saved = await svc.get(request.authz, taskId, startDateTime);
			return reply.status(200).send(saved); // nosemgrep
		},
	});

	done();
}

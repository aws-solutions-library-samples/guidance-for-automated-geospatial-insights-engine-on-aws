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
import { forbiddenResponse, notFoundResponse } from '../../common/schemas.js';
import { name, taskId, taskItemResource } from '../../common/taskItems/schemas.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { taskItemResourceExample } from './examples.js';

export default function getTaskItemRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/polygonTasks/:taskId/taskItems/:name',

		schema: {
			description: `Retrieve details of an polygon task item in an activity task`,
			tags: ['Task Item'],
			params: Type.Object({
				taskId,
				name,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskItemResource),
					'x-examples': {
						'Existing Polygon Task Item': {
							summary: 'Polygon Task Item Details',
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
			const svc = fastify.diContainer.resolve('polygonTaskItemService');
			const { taskId, name } = request.params;
			const saved = await svc.get(request.authz, taskId, name);
			return reply.status(200).send(saved); // nosemgrep
		},
	});

	done();
}

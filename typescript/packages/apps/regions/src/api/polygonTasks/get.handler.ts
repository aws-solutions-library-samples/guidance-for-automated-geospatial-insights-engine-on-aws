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
import { forbiddenResponse, notFoundResponse, polygonTaskId } from '../../common/schemas.js';
import { taskResource } from '../../common/tasks/schemas.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { polygonTaskResourceExample } from './examples.js';

export default function getPolygonTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/polygonTasks/:taskId',

		schema: {
			description: `Retrieve details of an polygon task`,
			tags: ['Polygon Task'],
			params: Type.Object({
				taskId: polygonTaskId,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskResource),
					'x-examples': {
						'Existing Polygon Task': {
							summary: 'Polygon Task Details',
							value: polygonTaskResourceExample,
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
			const svc = fastify.diContainer.resolve('polygonTaskService');
			const { taskId } = request.params;
			const saved = await svc.get(request.authz, taskId);
			return reply.status(200).send(saved); // nosemgrep
		},
	});

	done();
}

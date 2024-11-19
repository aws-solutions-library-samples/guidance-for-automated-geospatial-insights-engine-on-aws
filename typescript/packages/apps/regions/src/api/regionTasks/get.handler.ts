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
import { forbiddenResponse, notFoundResponse, regionTaskId } from '../../common/schemas.js';
import { taskResource } from '../../common/tasks/schemas.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { regionTaskResourceExample } from './examples.js';

export default function getRegionTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/regionTasks/:taskId',

		schema: {
			description: `Retrieve details of an region task`,
			tags: ['Region Task'],
			params: Type.Object({
				taskId: regionTaskId,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(taskResource),
					'x-examples': {
						'Existing Region Task': {
							summary: 'Region Task Details',
							value: regionTaskResourceExample,
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
			const svc = fastify.diContainer.resolve('regionTaskService');
			const { taskId } = request.params;
			const saved = await svc.get(request.authz, taskId);
			return reply.status(200).send(saved); // nosemgrep
		},
	});

	done();
}

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
import { apiVersion100, FastifyTypebox } from "../../common/types.js";
import {
	commonHeaders,
	forbiddenResponse,
	noBodyResponse,
	notFoundResponse,
	polygonTaskId
} from "../../common/schemas.js";
import { atLeastAdmin } from "../../common/scopes.js";


export default function deletePolygonTaskRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'DELETE',
		url: '/polygonTasks/:id',

		schema: {
			summary: 'Deletes an polygon task',
			description: `Deletes an polygon task.

Permissions:
- Only \`admin\` and above may delete polygon tasks.
`,
			tags: ['Polygon Tasks'],
			operationId: 'deletePolygonTask',
			headers: commonHeaders,
			params: Type.Object({
				id: polygonTaskId,
			}),
			response: {
				204: noBodyResponse,
				403: forbiddenResponse,
				404: notFoundResponse,
			},
			'x-security-scopes': atLeastAdmin,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc = fastify.diContainer.resolve('polygonTaskService');
			const { id } = request.params;
			await svc.delete(request.authz, id);
			return reply.status(204).send();
		},
	});

	done();
}

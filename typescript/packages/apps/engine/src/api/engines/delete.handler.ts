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

import { apiVersion100, commonHeaders, FastifyTypebox, forbiddenResponse, noBodyResponse, notFoundResponse } from '@agie/resource-api-base';
import { atLeastAdmin } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { engineId } from './schemas.js';

export default function deleteEngineRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'DELETE',
		url: '/engines/:engineId',
		schema: {
			summary: 'Deletes an engine.',
			description: `Deletes an engine.

Permissions:
- Only \`admin\` and above may delete engine.
`,
			tags: ['Engines'],
			operationId: 'deleteEngine',
			headers: commonHeaders,
			params: Type.Object({
				engineId,
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
			const svc = fastify.diContainer.resolve('engineService');
			const { engineId } = request.params;
			await svc.delete(request.authz, engineId);
			return reply.status(204).send();
		},
	});

	done();
}

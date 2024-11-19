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
import { atLeastReader } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { engineExample } from './examples.js';
import { engineResource } from './schemas.js';
import { EngineService } from './service.js';

export default function getEngineRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/engines/:id',

		schema: {
			description: `Retrieve details of engine`,
			tags: ['Engine'],
			params: Type.Object({
				id,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(engineResource),
					'x-examples': {
						'Existing Engine': {
							summary: 'Existing Engine details.',
							value: engineExample,
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
			const svc: EngineService = fastify.diContainer.resolve('engineService');
			const { id } = request.params;
			const saved = await svc.get(request.authz, id);
			return reply.status(200).send(saved); // nosemgrep
		},
	});

	done();
}

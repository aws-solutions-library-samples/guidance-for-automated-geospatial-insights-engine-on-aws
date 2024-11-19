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

import { apiVersion100, badRequestResponse, commonHeaders, FastifyTypebox } from '@agie/resource-api-base';
import { atLeastContributor } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { engineExample, updateEngineRequestExample } from './examples.js';
import { engineId, engineResource, engineUpdate } from './schemas.js';
import { EngineService } from './service.js';

export default function updateEngineRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'PATCH',
		url: '/engines/:engineId',
		schema: {
			description: `Update an existing processing engine`,
			headers: commonHeaders,
			tags: ['Engine'],
			params: Type.Object({
				engineId: engineId,
			}),
			body: {
				...Type.Ref(engineUpdate),
				'x-examples': {
					'update engine request': {
						value: updateEngineRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...Type.Ref(engineResource),
					'x-examples': {
						Engine: {
							summary: 'Updated engine detail.',
							value: engineExample,
						},
					},
				},
				400: badRequestResponse,
			},
			'x-security-scopes': atLeastContributor,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc: EngineService = fastify.diContainer.resolve('engineService');
			const { engineId } = request.params;
			const saved = await svc.update(request.authz, engineId, request.body);
			return reply.status(200).send(saved);
		},
	});

	done();
}

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
import { engineExample, newEngineRequestExample } from './examples.js';
import { engineNew, engineResource } from './schemas.js';
import { EngineService } from './service.js';

export default function createEngineRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/engines',
		schema: {
			description: `Define a new engine.`,
			headers: commonHeaders,
			tags: ['Engine'],
			body: {
				...Type.Ref(engineNew),
				'x-examples': {
					'New engine': {
						summary: 'Define a new engine.',
						value: newEngineRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...Type.Ref(engineResource),
					'x-examples': {
						Engine: {
							summary: 'Create engine detail.',
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
			const saved = await svc.create(request.authz, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved); // nosemgrep
		},
	});

	done();
}

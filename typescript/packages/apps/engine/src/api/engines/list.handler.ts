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

import { apiVersion100, countPaginationQS, FastifyTypebox, fromTokenPaginationQS } from '@agie/resource-api-base';
import { atLeastReader } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { engineListExample } from './examples.js';
import { engineList, EngineResourceList } from './schemas.js';
import { EngineService } from './service.js';

export default function listEngineRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/engines',
		schema: {
			description: `Lists Engine Resources`,
			tags: ['Engine'],
			querystring: Type.Object({
				count: countPaginationQS,
				fromEngineId: fromTokenPaginationQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(engineList),
					'x-examples': {
						'List of Engines': {
							summary: 'Paginated list of engines',
							value: engineListExample,
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
			const svc: EngineService = fastify.diContainer.resolve('engineService');

			// parse request
			const { count, fromEngineId: fromToken } = request.query;

			const [engines, lastEvaluatedToken] = await svc.list(request.authz, {
				count,
				token: fromToken,
			});
			const response: EngineResourceList = { engines };

			if (count || lastEvaluatedToken) {
				response.pagination = {};
				if (lastEvaluatedToken) {
					response.pagination.lastEvaluated = lastEvaluatedToken;
				}
			}

			fastify.log.debug(`list.handler> exit:${JSON.stringify(response)}`);
			await reply.status(200).send(response); // nosemgrep
		},
	});

	done();
}

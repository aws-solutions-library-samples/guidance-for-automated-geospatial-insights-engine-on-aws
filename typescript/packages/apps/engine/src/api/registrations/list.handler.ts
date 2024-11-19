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
import { engineId } from '../engines/schemas.js';
import { registrationListExample } from './examples.js';
import { registrationResourceList, RegistrationResourceList } from './schemas.js';
import { RegistrationService } from './service.js';

export default function listRegistrationRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/engines/:engineId/registrations',
		schema: {
			description: `Lists Regions associated with Engine`,
			tags: ['Registrations'],
			querystring: Type.Object({
				count: countPaginationQS,
				fromRegionId: fromTokenPaginationQS,
			}),
			params: Type.Object({
				engineId: engineId,
			}),
			response: {
				200: {
					description: 'Success.',
					...Type.Ref(registrationResourceList),
					'x-examples': {
						'List of Engines': {
							summary: 'Paginated list of registration',
							value: registrationListExample,
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
			const svc: RegistrationService = fastify.diContainer.resolve('registrationService');

			const { engineId } = request.params;

			// parse request
			const { count, fromRegionId: fromToken } = request.query;

			const [registrations, lastEvaluatedToken] = await svc.list(request.authz, engineId, {
				count,
				token: fromToken,
			});
			const response: RegistrationResourceList = { registrations };

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

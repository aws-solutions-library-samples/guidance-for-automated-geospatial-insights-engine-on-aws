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
import { commonHeaders } from '../../common/schemas.js';
import { atLeastReader } from '../../common/scopes.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { resultResourceExample } from './example.js';
import { regionId, result } from './schemas.js';
import { ResultsService } from './service.js';

export default function getResultRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/regions/:regionId/results/:resultId',

		schema: {
			summary: 'Get pipeline result by id.',
			description: `Get pipeline result by id.

Permissions:
- \`readers\` may list results.
`,
			tags: ['Results'],
			operationId: 'listResults',
			headers: commonHeaders,
			params: Type.Object({
				regionId: regionId,
				resultId: regionId
			}),
			response: {
				200: {
					description: 'Success.',
					...result,
					'x-examples': {
						'Sample result': {
							summary: 'Sample result of successful pipeline execution.',
							value: resultResourceExample
						}
					}
				}
			},
			'x-security-scopes': atLeastReader
		},
		constraints: {
			version: apiVersion100
		},

		handler: async (request, reply) => {
			const svc:ResultsService = fastify.diContainer.resolve('resultsService');
			// parse request
			const { regionId, resultId } = request.params;
			const result = await svc.get(request.authz, regionId, resultId);
			fastify.log.debug(`get.handler> exit:${JSON.stringify(result)}`);
			await reply.status(200).send(result); // nosemgrep
		}
	});

	done();
}

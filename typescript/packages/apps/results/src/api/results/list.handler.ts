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
import { commonHeaders, countPaginationQS, fromTokenPaginationQS } from '../../common/schemas.js';
import { atLeastReader } from '../../common/scopes.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { regionId, resultList, ResultList } from './schemas.js';
import { resultListResourceExample } from "./example.js";

export default function listResultsRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/regions/:regionId/results',

		schema: {
			summary: 'List all results when processing a region.',
			description: `List all results when processing a region.

Permissions:
- \`readers\` may list results.
`,
			tags: ['Results'],
			operationId: 'listResults',
			headers: commonHeaders,
			params: Type.Object({
				regionId: regionId,
			}),
			querystring: Type.Object({
				count: countPaginationQS,
				paginationToken: fromTokenPaginationQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...resultList,
					'x-examples': {
						'List of results': {
							summary: 'Paginated list of results.',
							value: resultListResourceExample,
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
			const svc = fastify.diContainer.resolve('resultsService');

			// parse request
			const { count, paginationToken } = request.query;
			const { regionId } = request.params;
			const [results, nextToken] = await svc.list(request.authz, regionId, { token: paginationToken, count });
			const response: ResultList = { results };
			if (count || nextToken) {
				response.pagination = {
					token: nextToken,
					count,
				};
			}

			fastify.log.debug(`list.handler> exit:${JSON.stringify(response)}`);
			await reply.status(200).send(response); // nosemgrep
		},
	});

	done();
}

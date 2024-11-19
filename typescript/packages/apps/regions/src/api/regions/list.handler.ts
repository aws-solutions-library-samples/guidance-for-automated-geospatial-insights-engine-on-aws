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
import { commonHeaders, countPaginationQS, fromTokenPaginationQS, groupIdQS, nameQS, tagFilterQS } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { regionListResource } from './example.js';
import { RegionList, regionList } from './schemas.js';

export default function listRegionsRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/regions',

		schema: {
			summary: 'List all regions.',
			description: `List all regions.

Permissions:
- \`readers\` may list regions.
`,
			tags: ['Regions'],
			operationId: 'listRegions',
			headers: commonHeaders,
			querystring: Type.Object({
				count: countPaginationQS,
				paginationToken: fromTokenPaginationQS,
				name: nameQS,
				tags: tagFilterQS,
				groupId: groupIdQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...regionList,
					'x-examples': {
						'List of regions': {
							summary: 'Paginated list of regions.',
							value: regionListResource,
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
			const svc = fastify.diContainer.resolve('regionService');
			const tagUtils = fastify.diContainer.resolve('tagUtils');

			// parse request
			const { count, paginationToken, name, tags, groupId } = request.query;
			const [regions, nextToken] = await svc.list(request.authz, {
				count,
				token: paginationToken,
				name,
				tags: tagUtils.expandTagsQS(tags),
				groupId,
			});

			const response: RegionList = { regions };
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

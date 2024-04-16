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
import { commonHeaders, countPaginationQS, fromTokenPaginationQS, groupIdQS, nameQS, regionIdQS, tagFilterQS } from '../../common/schemas.js';
import { atLeastReader } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { zoneListResource } from './example.js';
import { ZoneList, includeLatestStateQS, zoneList } from './schemas.js';

export default function listZonesRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/zones',

		schema: {
			summary: 'List all zones.',
			description: `List all zones.

Permissions:
- \`readers\` may list zones.
`,
			tags: ['Zones'],
			operationId: 'listZones',
			headers: commonHeaders,
			querystring: Type.Object({
				count: countPaginationQS,
				paginationToken: fromTokenPaginationQS,
				name: nameQS,
				tags: tagFilterQS,
				groupId: groupIdQS,
				regionId: regionIdQS,
				includeLatestState: includeLatestStateQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...zoneList,
					'x-examples': {
						'List of zones': {
							summary: 'Paginated list of zones.',
							value: zoneListResource,
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
			const svc = fastify.diContainer.resolve('zoneService');
			const tagUtils = fastify.diContainer.resolve('tagUtils');

			// parse request
			const { count, paginationToken, name, tags, groupId, regionId, includeLatestState } = request.query;
			const [zones, nextToken] = await svc.list(request.authz, {
				count,
				token: paginationToken,
				name,
				tags: tagUtils.expandTagsQS(tags),
				groupId,
				regionId,
				includeLatestState,
			});

			const response: ZoneList = { zones };
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

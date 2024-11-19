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
import { commonHeaders, countPaginationQS, fromTokenPaginationQS, nameQS, tagFilterQS } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { groupListResource } from './example.js';
import { GroupList, groupList } from './schemas.js';

export default function listGroupsRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/groups',

		schema: {
			summary: 'List all groups.',
			description: `List all groups.

Permissions:
- \`readers\` may list groups.
`,
			tags: ['Groups'],
			operationId: 'listGroups',
			headers: commonHeaders,
			querystring: Type.Object({
				count: countPaginationQS,
				paginationToken: fromTokenPaginationQS,
				name: nameQS,
				tags: tagFilterQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...groupList,
					'x-examples': {
						'List of groups': {
							summary: 'Paginated list of groups.',
							value: groupListResource,
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
			const svc = fastify.diContainer.resolve('groupService');
			const tagUtils = fastify.diContainer.resolve('tagUtils');

			// parse request
			const { count, paginationToken, name, tags } = request.query;
			const [groups, nextToken] = await svc.list(request.authz, {
				count,
				token: paginationToken,
				name,
				tags: tagUtils.expandTagsQS(tags),
			});

			const response: GroupList = { groups };
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

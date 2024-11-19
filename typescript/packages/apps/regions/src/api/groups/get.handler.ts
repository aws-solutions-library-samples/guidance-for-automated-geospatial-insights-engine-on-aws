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
import { commonHeaders, groupId, notFoundResponse } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { groupResourceExample1 } from './example.js';
import { groupResource } from './schemas.js';

export default function getGroupRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/groups/:groupId',

		schema: {
			summary: 'Retrieve a group.',
			description: `Retrieve the details of a group.

Permissions:
- Only \`reader\` and above may view groups.
`,
			tags: ['Groups'],
			operationId: 'getGroup',
			headers: commonHeaders,
			params: Type.Object({
				groupId,
			}),
			response: {
				200: {
					description: 'Success.',
					...groupResource,
					'x-examples': {
						'Existing group': {
							summary: 'Group retrieved successfully.',
							value: groupResourceExample1,
						},
					},
				},
				404: notFoundResponse,
			},
			'x-security-scopes': atLeastReader,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc = fastify.diContainer.resolve('groupService');
			const { groupId } = request.params;
			const group = await svc.get(request.authz, groupId);
			return reply.status(200).send(group);
		},
	});

	done();
}

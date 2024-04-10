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
import { commonHeaders, countPaginationQS, fromTokenPaginationQS, groupIdQS, regionIdQS, tagFilterQS, zoneIdQS } from '../../common/schemas.js';
import { atLeastReader } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { stateListResource } from './example.js';
import { latestStateOnlyQS, stateList } from './schemas.js';

export default function listStatesRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/states',

		schema: {
			summary: 'List all states.',
			description: `List all states.

Permissions:
- \`readers\` may list states.
`,
			tags: ['States'],
			operationId: 'listStates',
			headers: commonHeaders,
			querystring: Type.Object({
				count: countPaginationQS,
				fromToken: fromTokenPaginationQS,
				tags: tagFilterQS,
				groupId: groupIdQS,
				regionId: regionIdQS,
				zoneId: zoneIdQS,
				latestOnly: latestStateOnlyQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...stateList,
					'x-examples': {
						'List of states': {
							summary: 'Paginated list of states.',
							value: stateListResource,
						},
					},
				},
			},
			'x-security-scopes': atLeastReader,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (_request, _reply) => {
			// TODO
		},
	});

	done();
}

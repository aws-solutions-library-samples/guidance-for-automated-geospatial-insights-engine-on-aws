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
import { SubscriptionList, subscriptionListResource } from './schemas.js';
import { subscriptionListResourceExample } from "./example.js";

export default function listSubscriptionsRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/subscriptions',

		schema: {
			summary: 'List subscriptions for the current user in context.',
			description: `List subscriptions for the current user in context.

Permissions:
- \`readers\` may list subscriptions.
`,
			tags: ['Subscriptions'],
			operationId: 'listSubscriptions',
			headers: commonHeaders,
			querystring: Type.Object({
				count: countPaginationQS,
				paginationToken: fromTokenPaginationQS,
			}),
			response: {
				200: {
					description: 'Success.',
					...subscriptionListResource,
					'x-examples': {
						'List of subscriptions': {
							summary: 'Paginated list of subscriptions.',
							value: subscriptionListResourceExample,
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
			const svc = fastify.diContainer.resolve('subscriptionsService');

			// parse request
			const { count, paginationToken } = request.query;
			const [subscriptions, nextToken] = await svc.list(request.authz, { lastEvaluatedToken: paginationToken, count });

			const response: SubscriptionList = { subscriptions: subscriptions };

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

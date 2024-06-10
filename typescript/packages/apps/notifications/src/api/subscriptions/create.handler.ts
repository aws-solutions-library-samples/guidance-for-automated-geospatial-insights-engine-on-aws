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
import { badRequestResponse, commonHeaders, conflictResponse } from '../../common/schemas.js';
import { atLeastContributor } from '../../common/scopes.js';
import { apiVersion100, FastifyTypebox } from '../../common/types.js';
import { createSubscriptionRequestBody, regionId, subscriptionResource } from './schemas.js';
import { SubscriptionsService } from "./service.js";
import { subscriptionPostRequestExample, subscriptionResourceExample } from './example.js';

export default function createSubscriptionRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/regions/:regionId/subscriptions',
		schema: {
			summary: 'Create a new subscription',
			description: `Create a new subscription.

Permissions:
- Only \`contributor\` and above may create new subscriptions.
`,
			tags: ['Subscriptions'],
			headers: commonHeaders,
			operationId: 'createRegion',
			params: Type.Object({
				regionId: regionId
			}),
			body: {
				...Type.Ref(createSubscriptionRequestBody),
				'x-examples': {
					'New subscription': {
						summary: 'Create a new subscription.',
						value: subscriptionPostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...subscriptionResource,
					'x-examples': {
						'New subscription': {
							summary: 'New subscription created successfully.',
							value: subscriptionResourceExample,
						},
					},
				},
				400: {
					...badRequestResponse,
					'x-examples': {
						'Invalid request': {
							summary: 'Invalid request.',
							value: {
								description: 'Expected `name` to be defined but not provided.',
							},
						},
					},
				},
				409: {
					...conflictResponse,
					'x-examples': {
						'Name in use': {
							summary: 'The `name` is already in use.',
							value: {
								description: 'Name `xyz` already exists.',
							},
						},
					},
				},
			},
			'x-security-scopes': atLeastContributor,
		},
		constraints: {
			version: apiVersion100,
		},

		handler: async (request, reply) => {
			const svc: SubscriptionsService = fastify.diContainer.resolve('subscriptionsService');
			const { regionId } = request.params
			const saved = await svc.create(request.authz, { regionId });
			return reply.header('x-id', saved.id).status(201).send(saved);
		},
	});

	done();
}

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
import { badRequestResponse, commonHeaders, conflictResponse, groupId } from '../../common/schemas.js';
import { atLeastContributor } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { regionPostRequestExample, regionResourceExample1 } from './example.js';
import { createRegionRequestBody, regionResource } from './schemas.js';

export default function createRegionRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/groups/:groupId/regions',

		schema: {
			summary: 'Define a new region',
			description: `Define a new region.

Permissions:
- Only \`admin\` and above may create new regions.
`,
			tags: ['Regions'],
			headers: commonHeaders,
			operationId: 'createRegion',
			params: Type.Object({
				groupId: groupId,
			}),
			body: {
				...Type.Ref(createRegionRequestBody),
				'x-examples': {
					'New region': {
						summary: 'Create a new region.',
						value: regionPostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...regionResource,
					'x-examples': {
						'New region': {
							summary: 'New region created successfully.',
							value: regionResourceExample1,
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
			// TODO
		},
	});

	done();
}

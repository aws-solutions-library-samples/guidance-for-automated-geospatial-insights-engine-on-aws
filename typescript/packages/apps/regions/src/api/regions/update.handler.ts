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
import { badRequestResponse, commonHeaders, conflictResponse, forbiddenResponse, notFoundResponse, regionId } from '../../common/schemas.js';
import { atLeastContributor } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { regionPatchRequestExample1, regionPatchRequestExample2, regionResourceExample2 } from './example.js';
import { editRegionRequestBody, regionResource } from './schemas.js';

export default function updateRegionRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'PATCH',
		url: '/regions/:regionId',

		schema: {
			summary: 'Update a region.',
			description: `Update an existing region.

Permissions:
- Only \`admins\` may update regions.
`,
			tags: ['Regions'],
			operationId: 'updateRegion',
			headers: commonHeaders,
			params: Type.Object({
				regionId: regionId,
			}),
			body: {
				...Type.Ref(editRegionRequestBody),
				'x-examples': {
					'Update region': {
						summary: 'Update an existing region.',
						value: regionPatchRequestExample1,
					},
					'Changing tags': {
						summary: 'Changing the tags of a region.',
						value: regionPatchRequestExample2,
					},
				},
			},
			response: {
				200: {
					description: 'Success.',
					...regionResource,
					'x-examples': {
						'Existing region updated successfully': {
							summary: 'Existing region created successfully.',
							value: regionResourceExample2,
						},
					},
				},
				400: {
					...badRequestResponse,
					'x-examples': {
						'Invalid request': {
							summary: 'Invalid request.',
							value: {
								description: 'Expected `formula` to be defined but not provided.',
							},
						},
					},
				},
				403: forbiddenResponse,
				404: notFoundResponse,
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
			const svc = fastify.diContainer.resolve('regionService');
			const { regionId } = request.params;
			const saved = await svc.update(request.authz, regionId, request.body);
			return reply.status(200).send(saved);
		},
	});

	done();
}

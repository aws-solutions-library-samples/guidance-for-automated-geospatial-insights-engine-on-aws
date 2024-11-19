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

import { atLeastContributor } from '@agie/rest-api-authorizer';
import { Type } from '@sinclair/typebox';
import { badRequestResponse, commonHeaders, conflictResponse, forbiddenResponse, groupId, notFoundResponse } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { groupPatchRequestExample1, groupPatchRequestExample2, groupResourceExample2 } from './example.js';
import { editGroupRequestBody, groupResource } from './schemas.js';

export default function updateGroupRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'PATCH',
		url: '/groups/:groupId',

		schema: {
			summary: 'Update a group.',
			description: `Update an existing group.

Permissions:
- Only \`admins\` may update groups.
`,
			tags: ['Groups'],
			operationId: 'updateGroup',
			headers: commonHeaders,
			params: Type.Object({
				groupId: groupId,
			}),
			body: {
				...Type.Ref(editGroupRequestBody),
				'x-examples': {
					'Update group': {
						summary: 'Update an existing group.',
						value: groupPatchRequestExample1,
					},
					'Changing tags': {
						summary: 'Changing the tags of a group.',
						value: groupPatchRequestExample2,
					},
				},
			},
			response: {
				200: {
					description: 'Success.',
					...groupResource,
					'x-examples': {
						'Existing group updated successfully': {
							summary: 'Existing group created successfully.',
							value: groupResourceExample2,
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
			const svc = fastify.diContainer.resolve('groupService');
			const { groupId } = request.params;
			const saved = await svc.update(request.authz, groupId, request.body);
			return reply.status(200).send(saved);
		},
	});

	done();
}

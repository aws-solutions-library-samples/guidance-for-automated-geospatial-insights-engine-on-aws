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
import { badRequestResponse, commonHeaders, conflictResponse, regionId } from '../../common/schemas.js';
import { atLeastContributor } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { zonePostRequestExample, zoneResourceExample1 } from './example.js';
import { createZoneRequestBody, zoneResource } from './schemas.js';

export default function createZoneRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'POST',
		url: '/regions/:regionId/zones',

		schema: {
			summary: 'Define a new zone',
			description: `Define a new zone.

Permissions:
- Only \`admin\` and above may create new zones.
`,
			tags: ['Zones'],
			headers: commonHeaders,
			operationId: 'createZone',
			params: Type.Object({
				regionId: regionId,
			}),
			body: {
				...Type.Ref(createZoneRequestBody),
				'x-examples': {
					'New zone': {
						summary: 'Create a new zone.',
						value: zonePostRequestExample,
					},
				},
			},
			response: {
				201: {
					description: 'Success.',
					...zoneResource,
					'x-examples': {
						'New zone': {
							summary: 'New zone created successfully.',
							value: zoneResourceExample1,
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
			const svc = fastify.diContainer.resolve('zoneService');
			const { regionId } = request.params;
			const saved = await svc.create(request.authz, regionId, request.body);
			return reply.header('x-id', saved.id).status(201).send(saved);
		},
	});

	done();
}
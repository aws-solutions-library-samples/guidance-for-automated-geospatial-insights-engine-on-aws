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
import { badRequestResponse, commonHeaders, conflictResponse, forbiddenResponse, zoneId, notFoundResponse } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { zonePatchRequestExample1, zonePatchRequestExample2, zoneResourceExample2 } from './example.js';
import { editZoneRequestBody, zoneResource } from './schemas.js';
import { atLeastContributor } from '../../common/scopes.js';

export default function updateZoneRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'PATCH',
		url: '/zones/:zoneId',

		schema: {
			summary: 'Update a zone.',
			description: `Update an existing zone.

Permissions:
- Only \`admins\` may update zones.
`,
			tags: ['Zones'],
			operationId: 'updateZone',
			headers: commonHeaders,
			params: Type.Object({
				zoneId: zoneId,
			}),
			body: {
				...Type.Ref(editZoneRequestBody),
				'x-examples': {
					'Update zone': {
						summary: 'Update an existing zone.',
						value: zonePatchRequestExample1,
					},
					'Changing tags': {
						summary: 'Changing the tags of a zone.',
						value: zonePatchRequestExample2,
					},
				},
			},
			response: {
				200: {
					description: 'Success.',
					...zoneResource,
					'x-examples': {
						'Existing zone updated successfully': {
							summary: 'Existing zone created successfully.',
							value: zoneResourceExample2,
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

		handler: async (_request, _reply) => {
			// TODO
		},
	});

	done();
}

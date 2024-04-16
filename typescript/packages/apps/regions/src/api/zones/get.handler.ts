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
import { commonHeaders, notFoundResponse, zoneId } from '../../common/schemas.js';
import { atLeastReader } from '../../common/scopes.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { zoneResourceExample1 } from './example.js';
import { zoneResource } from './schemas.js';

export default function getZoneRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/zones/:zoneId',

		schema: {
			summary: 'Retrieve a zone.',
			description: `Retrieve the details of a zone.

Permissions:
- Only \`reader\` and above may view zones.
`,
			tags: ['Zones'],
			operationId: 'getZone',
			headers: commonHeaders,
			params: Type.Object({
				zoneId: zoneId,
			}),
			response: {
				200: {
					description: 'Success.',
					...zoneResource,
					'x-examples': {
						'Existing zone': {
							summary: 'Zone retrieved successfully.',
							value: zoneResourceExample1,
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
			const svc = fastify.diContainer.resolve('zoneService');
			const { zoneId } = request.params;
			const zone = await svc.get(request.authz, zoneId);
			return reply.status(200).send(zone);
		},
	});

	done();
}

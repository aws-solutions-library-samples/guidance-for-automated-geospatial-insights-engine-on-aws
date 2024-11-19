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
import { commonHeaders, notFoundResponse, regionId } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { regionResourceExample1 } from './example.js';
import { regionResource } from './schemas.js';

export default function getRegionRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/regions/:regionId',

		schema: {
			summary: 'Retrieve a region.',
			description: `Retrieve the details of a region.

Permissions:
- Only \`reader\` and above may view regions.
`,
			tags: ['Regions'],
			operationId: 'getRegion',
			headers: commonHeaders,
			params: Type.Object({
				regionId: regionId,
			}),
			response: {
				200: {
					description: 'Success.',
					...regionResource,
					'x-examples': {
						'Existing region': {
							summary: 'Region retrieved successfully.',
							value: regionResourceExample1,
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
			const svc = fastify.diContainer.resolve('regionService');
			const { regionId } = request.params;
			const region = await svc.get(request.authz, regionId);
			return reply.status(200).send(region);
		},
	});

	done();
}

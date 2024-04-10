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
import { commonHeaders, stateId, notFoundResponse } from '../../common/schemas.js';
import { FastifyTypebox, apiVersion100 } from '../../common/types.js';
import { stateResourceExample1 } from './example.js';
import { stateResource } from './schemas.js';
import { atLeastReader } from '../../common/scopes.js';

export default function getStateRoute(fastify: FastifyTypebox, _options: unknown, done: () => void): void {
	fastify.route({
		method: 'GET',
		url: '/states/:stateId',

		schema: {
			summary: 'Retrieve a state.',
			description: `Retrieve the state of a zone.

Permissions:
- Only \`reader\` and above may view states.
`,
			tags: ['States'],
			operationId: 'getState',
			headers: commonHeaders,
			params: Type.Object({
				stateId: stateId,
			}),
			response: {
				200: {
					description: 'Success.',
					...stateResource,
					'x-examples': {
						'Existing state': {
							summary: 'State retrieved successfully.',
							value: stateResourceExample1,
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
			// TODO
		},
	});

	done();
}

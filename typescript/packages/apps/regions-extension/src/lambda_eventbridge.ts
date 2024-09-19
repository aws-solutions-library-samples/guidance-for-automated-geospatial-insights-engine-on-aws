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

import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { DomainEvent, RESULTS_EVENT_SOURCE, RESULTS_RESULT_CREATED_EVENT, RESULTS_RESULT_UPDATED_EVENT } from "@agie/events";
import { RegionsClient, ResultResource } from "@agie/clients";
import ow from 'ow';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const regionsClient = di.resolve<RegionsClient>('regionsClient');

export const handler: EventBridgeHandler<any, DomainEvent<ResultResource>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	if ([RESULTS_RESULT_UPDATED_EVENT, RESULTS_RESULT_CREATED_EVENT].includes(event["detail-type"]) && event['source'] === RESULTS_EVENT_SOURCE) {

		ow(event, ow.object.nonEmpty)
		ow(event.detail, ow.object.nonEmpty)
		ow(event.detail.new, ow.object.partialShape(
			{
				id: ow.string.nonEmpty,
				status: ow.string.nonEmpty,
				createdAt: ow.string.nonEmpty,
				message: ow.optional.string
			}
		))

		const result = event.detail.new;
		const securityContext = {
			authorizer: {
				claims: {
					email: 'results',
					'custom:role': '/|||contributor',
				},
			}
		};

		// update the region resource tag with execution information
		await regionsClient.updateRegion(result.regionId, {
			attributes: {
				'agie:results:id': result.id,
				'agie:results:status': result.status,
				'agie:results:message': result.message,
				'agie:results:createdAt': result.createdAt,
				'agie:results:updatedAt': result.updatedAt,
			}
		}, securityContext);
	}

	app.log.info(`EventBridgeLambda> handler> exit`);
};

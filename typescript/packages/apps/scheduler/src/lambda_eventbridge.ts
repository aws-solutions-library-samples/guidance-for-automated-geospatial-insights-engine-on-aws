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
import { SchedulesService } from "./schedules/service.js";
import {
	DomainEvent,
	RegionResource,
	REGIONS_EVENT_SOURCE,
	REGIONS_REGION_CREATED_EVENT,
	REGIONS_REGION_DELETED_EVENT,
	REGIONS_REGION_UPDATED_EVENT
} from "@arcade/events";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const schedulesService = di.resolve<SchedulesService>('schedulesService');
export const handler: EventBridgeHandler<string, DomainEvent<RegionResource>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);
	if (event['source'] === REGIONS_EVENT_SOURCE && [REGIONS_REGION_CREATED_EVENT, REGIONS_REGION_UPDATED_EVENT, REGIONS_REGION_DELETED_EVENT].includes(event['detail-type'])) {
		await schedulesService.process(event.detail);
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}
	app.log.info(`EventBridgeLambda > handler >exit`);
};

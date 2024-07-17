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
import { DomainEvent, EngineJobDetails, EXECUTOR_EVENT_SOURCE, EXECUTOR_JOB_CREATED_EVENT, EXECUTOR_JOB_UPDATED_EVENT } from "@arcade/events";
import { NotificationsService } from "./api/notifications/service.js";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const notificationService = di.resolve<NotificationsService>('notificationsService');

export const handler: EventBridgeHandler<string, DomainEvent<EngineJobDetails>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);
	if ([EXECUTOR_JOB_UPDATED_EVENT, EXECUTOR_JOB_CREATED_EVENT].includes(event['detail-type']) && event['source'] === EXECUTOR_EVENT_SOURCE && ['succeeded', 'failed'].includes(event.detail.new.status)) {
		await notificationService.send(event.detail?.new)
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}

};

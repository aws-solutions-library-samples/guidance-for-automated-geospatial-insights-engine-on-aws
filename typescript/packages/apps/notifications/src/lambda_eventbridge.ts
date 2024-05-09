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

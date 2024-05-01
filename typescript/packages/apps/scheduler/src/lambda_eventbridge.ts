import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { SchedulesService } from "./schedules/service.js";
import { DomainEvent, REGIONS_EVENT_SOURCE, RESULTS_ZONE_CREATED_EVENT, RESULTS_ZONE_UPDATED_EVENT, ZoneResource } from "@arcade/events";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const schedulesService = di.resolve<SchedulesService>('schedulesService');
export const handler: EventBridgeHandler<string, DomainEvent<ZoneResource>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	if (((event['detail-type'] as string) === RESULTS_ZONE_CREATED_EVENT || event['detail-type'] as string === RESULTS_ZONE_UPDATED_EVENT) && event['source'] === REGIONS_EVENT_SOURCE) {
		await schedulesService.create(event.detail.new)
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}

	app.log.info(`EventBridgeLambda > handler >exit`);
};


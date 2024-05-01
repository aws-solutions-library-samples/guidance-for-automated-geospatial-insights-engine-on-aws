import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { SchedulesService } from "./schedules/service.js";
import { DomainEvent, RegionResource, REGIONS_EVENT_SOURCE, RESULTS_REGION_CREATED_EVENT, RESULTS_REGION_DELETED_EVENT, RESULTS_REGION_UPDATED_EVENT } from "@arcade/events";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const schedulesService = di.resolve<SchedulesService>('schedulesService');
export const handler: EventBridgeHandler<string, DomainEvent<RegionResource>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	if (((event['detail-type'] as string) === RESULTS_REGION_CREATED_EVENT || event['detail-type'] as string === RESULTS_REGION_UPDATED_EVENT) && event['source'] === REGIONS_EVENT_SOURCE) {
		await schedulesService.create(event?.detail?.new)
	} else if ((event['detail-type'] as string) === RESULTS_REGION_DELETED_EVENT && event['source'] === REGIONS_EVENT_SOURCE) {
		await schedulesService.delete(event?.detail?.old)
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}

	app.log.info(`EventBridgeLambda > handler >exit`);
};

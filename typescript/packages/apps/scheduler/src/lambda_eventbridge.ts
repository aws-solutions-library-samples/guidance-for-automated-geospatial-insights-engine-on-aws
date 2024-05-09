import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { SchedulesService } from "./schedules/service.js";
import { DomainEvent, RegionResource, REGIONS_EVENT_SOURCE, REGIONS_REGION_CREATED_EVENT, REGIONS_REGION_DELETED_EVENT, REGIONS_REGION_UPDATED_EVENT } from "@arcade/events";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const schedulesService = di.resolve<SchedulesService>('schedulesService');
export const handler: EventBridgeHandler<string, DomainEvent<RegionResource>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	if (event['source'] === REGIONS_EVENT_SOURCE) {
		switch (event['detail-type']) {
			case REGIONS_REGION_CREATED_EVENT:
			case REGIONS_REGION_UPDATED_EVENT:
				await schedulesService.create(event?.detail?.new);
				break;
			case REGIONS_REGION_DELETED_EVENT:
				await schedulesService.delete(event?.detail?.old)
				break;
			default:
				app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
		}
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}

	app.log.info(`EventBridgeLambda > handler >exit`);
};

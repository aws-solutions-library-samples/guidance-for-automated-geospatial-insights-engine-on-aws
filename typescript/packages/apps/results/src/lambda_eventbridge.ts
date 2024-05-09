import { buildLightApp } from './app.light.js';
import {
	EXECUTOR_EVENT_SOURCE,
	EXECUTOR_JOB_CREATED_EVENT,
	EXECUTOR_JOB_UPDATED_EVENT,
	EXECUTOR_POLYGON_METADATA_CREATED_EVENT,
	GroupChangeEvent,
	PolygonsProcessingEvent,
	RegionChangeEvent,
	REGIONS_EVENT_SOURCE,
	RESULTS_GROUP_CHANGE_EVENT,
	RESULTS_REGION_CHANGE_EVENT,
	ResultsChangeEvent,
} from '@arcade/events';
import type { AwilixContainer } from 'awilix';
import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { FastifyInstance } from 'fastify';
import type { EventProcessor } from './events/eventProcessor.js';
import ow from 'ow';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const eventProcessor = di.resolve<EventProcessor>('eventProcessor');

export  type EventDetails = ResultsChangeEvent | GroupChangeEvent | RegionChangeEvent;

export const handler: EventBridgeHandler<string, EventDetails, void> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);
	ow(event, ow.object.nonEmpty);
	ow(event["detail-type"], ow.string.nonEmpty);
	ow(event.source, ow.string.nonEmpty);
	/**
	 * Filter the group collection change event received from the regions module
	 */
	if ((event['detail-type'] as string) === RESULTS_GROUP_CHANGE_EVENT && event['source'] === REGIONS_EVENT_SOURCE) {
		await eventProcessor.processGroupChangeEvent(event as unknown as GroupChangeEvent);
	}

	/**
	 * Filter the region collection change event received from the regions module
	 */
	else if ((event['detail-type'] as string) === RESULTS_REGION_CHANGE_EVENT && event['source'] === REGIONS_EVENT_SOURCE) {
		await eventProcessor.processRegionChangeEvent(event as unknown as RegionChangeEvent);
	}

	/**
	 * Filter the polygon metadata created event from executor module
	 */
	else if ((event['detail-type'] as string) === EXECUTOR_POLYGON_METADATA_CREATED_EVENT && event['source'] === EXECUTOR_EVENT_SOURCE) {
		await eventProcessor.processExecutorPolygonMetadataCreatedEvent(event as unknown as PolygonsProcessingEvent);
	}

	/**
	 * Filter the job status update from the executor module
	 */
	else if ([EXECUTOR_JOB_UPDATED_EVENT, EXECUTOR_JOB_CREATED_EVENT].includes(event['detail-type']) && event['source'] === EXECUTOR_EVENT_SOURCE) {
		await eventProcessor.processExecutorJobUpdatedEvent(event as unknown as ResultsChangeEvent);
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}
	app.log.info(`EventBridgeLambda > handler >exit`);
};


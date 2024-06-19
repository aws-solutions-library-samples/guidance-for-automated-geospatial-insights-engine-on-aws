import {
	CatalogCreateEvent,
	CLI_CATALOG_CREATE_EVENT,
	CLI_EVENT_SOURCE,
	EXECUTOR_EVENT_SOURCE,
	EXECUTOR_JOB_CREATED_EVENT,
	EXECUTOR_JOB_UPDATED_EVENT,
	EXECUTOR_POLYGON_METADATA_CREATED_EVENT,
	GroupChangeEvent,
	PolygonsProcessingEvent,
	RegionChangeEvent,
	REGIONS_EVENT_SOURCE,
	REGIONS_REGION_CREATED_EVENT,
	REGIONS_REGION_DELETED_EVENT,
	REGIONS_REGION_UPDATED_EVENT,
	ResultsChangeEvent,
} from '@arcade/events';
import type { AwilixContainer } from 'awilix';
import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { FastifyInstance } from 'fastify';
import ow from 'ow';
import { buildLightApp } from './app.light.js';
import type { EventProcessor } from './events/eventProcessor.js';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const eventProcessor = di.resolve<EventProcessor>('eventProcessor');

export type EventDetails = ResultsChangeEvent | GroupChangeEvent | RegionChangeEvent;

export const handler: EventBridgeHandler<string, EventDetails, void> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);
	ow(event, ow.object.nonEmpty);
	ow(event['detail-type'], ow.string.nonEmpty);
	ow(event.source, ow.string.nonEmpty);

	/**
	 * Filter the catalog creation event received from the cli module
	 */
	if ((event['detail-type'] as string) === CLI_CATALOG_CREATE_EVENT && event['source'] === CLI_EVENT_SOURCE) {
		await eventProcessor.processCatalogCreationEvent(event as unknown as CatalogCreateEvent);
	} else if (
		/**
		 * Filter the region collection change event received from the regions module
		 */
		[REGIONS_REGION_CREATED_EVENT, REGIONS_REGION_UPDATED_EVENT, REGIONS_REGION_DELETED_EVENT].includes(event['detail-type']) &&
		event['source'] === REGIONS_EVENT_SOURCE
	) {
		await eventProcessor.processRegionChangeEvent(event as unknown as RegionChangeEvent);
	} else if ((event['detail-type'] as string) === EXECUTOR_POLYGON_METADATA_CREATED_EVENT && event['source'] === EXECUTOR_EVENT_SOURCE) {
		/**
		 * Filter the polygon metadata created event from executor module
		 */
		await eventProcessor.processExecutorPolygonMetadataCreatedEvent(event as unknown as PolygonsProcessingEvent);
	} else if ([EXECUTOR_JOB_UPDATED_EVENT, EXECUTOR_JOB_CREATED_EVENT].includes(event['detail-type']) && event['source'] === EXECUTOR_EVENT_SOURCE) {
		/**
		 * Filter the job status update from the executor module
		 */
		await eventProcessor.processExecutorJobUpdatedEvent(event as unknown as ResultsChangeEvent);
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}
	app.log.info(`EventBridgeLambda > handler >exit`);
};

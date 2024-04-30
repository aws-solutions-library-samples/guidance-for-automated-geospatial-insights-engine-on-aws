import {
	ENGINE_EVENT_SOURCE,
	GroupChangeEvent,
	REGIONS_EVENT_SOURCE,
	RESULTS_COMPLETED_EVENT,
	RESULTS_EVENT_SOURCE,
	RESULTS_FAILED_EVENT,
	RESULTS_GROUP_CHANGE_EVENT,
	RESULTS_QUEUED_EVENT,
	RESULTS_REGION_CHANGE_EVENT,
	RESULTS_STARTED_EVENT,
	RegionChangeEvent,
	ResultsChangeEvent,
	SCHEDULER_EVENT_SOURCE,
} from '@arcade/events';
import { validateNotEmpty } from '@arcade/validators';
import type { AwilixContainer } from 'awilix';
import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import type { EventProcessor } from './events/eventProcessor.js';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const eventProcessor = di.resolve<EventProcessor>('eventProcessor');

export const handler: EventBridgeHandler<string, EventDetails, void> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	validateNotEmpty(event, 'event');
	validateNotEmpty(event['detail-type'], 'event.detail-type');
	validateNotEmpty(event.source, 'event.source');

	/**
	 * Filter the group collection change event received from the regions module
	 */
	if ((event['detail-type'] as string) === RESULTS_GROUP_CHANGE_EVENT && event['source'] === REGIONS_EVENT_SOURCE) {
		await eventProcessor.processGroupChangeEvent(event as unknown as GroupChangeEvent);
	}

	/**
	 * Filter the region collection change event received from the regions module
	 */
	if ((event['detail-type'] as string) === RESULTS_REGION_CHANGE_EVENT && event['source'] === REGIONS_EVENT_SOURCE) {
		await eventProcessor.processRegionChangeEvent(event as unknown as RegionChangeEvent);
	} else if ((event['detail-type'] as string) === RESULTS_QUEUED_EVENT && event['source'] === SCHEDULER_EVENT_SOURCE) {
	/**
	 * Filter the queued event received from the schedular
	 */
		await eventProcessor.processQueuedEvent(event as unknown as ResultsChangeEvent);
	} else if ((event['detail-type'] as string) === RESULTS_STARTED_EVENT && event['source'] === ENGINE_EVENT_SOURCE) {
	/**
	 * Filter the started event
	 */
		await eventProcessor.processStartedEvent(event as unknown as ResultsChangeEvent);
	} else if ((event['detail-type'] as string) === RESULTS_COMPLETED_EVENT && [SCHEDULER_EVENT_SOURCE, ENGINE_EVENT_SOURCE, RESULTS_EVENT_SOURCE].includes(event['source'])) {
	/**
	 * Filter the Completed event
	 */
		await eventProcessor.processCompletedEvent(event as unknown as ResultsChangeEvent);
	} else if ((event['detail-type'] as string) === RESULTS_FAILED_EVENT && [SCHEDULER_EVENT_SOURCE, ENGINE_EVENT_SOURCE, RESULTS_EVENT_SOURCE].includes(event['source'])) {
	/**
	 * Filter the Failed event
	 */
		await eventProcessor.processFailedEvent(event as unknown as ResultsChangeEvent);
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}
	app.log.info(`EventBridgeLambda > handler >exit`);
};

type EventDetails = ResultsChangeEvent | GroupChangeEvent | RegionChangeEvent;

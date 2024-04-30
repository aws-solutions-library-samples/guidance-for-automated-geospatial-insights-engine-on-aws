import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import {
	SCHEDULER_EVENT_SOURCE,
	ENGINE_EVENT_SOURCE,
	RESULTS_QUEUED_EVENT,
	RESULTS_STARTED_EVENT,
	RESULTS_FAILED_EVENT,
	ResultsChangeEvent,
	RESULTS_EVENT_SOURCE,
	REGIONS_EVENT_SOURCE,
	GroupChangeEvent,
	RESULTS_GROUP_CHANGE_EVENT,
	RegionChangeEvent,
	RESULTS_REGION_CHANGE_EVENT,
	RESULTS_COMPLETED_EVENT
} from '@arcade/events';
import type { EventProcessor } from './events/eventProcessor.js';
import { validateNotEmpty } from '@arcade/validators';


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
	}
	/**
	 * Filter the queued event received from the schedular
	 */
	else if ((event['detail-type'] as string) === RESULTS_QUEUED_EVENT && event['source'] === SCHEDULER_EVENT_SOURCE) {
		await eventProcessor.processQueuedEvent(event as unknown as ResultsChangeEvent);
	}
	/**
	 * Filter the started event
	 */
	else if ((event['detail-type'] as string) === RESULTS_STARTED_EVENT && event['source'] === ENGINE_EVENT_SOURCE) {
		await eventProcessor.processStartedEvent(event as unknown as ResultsChangeEvent);
	}
	/**
	 * Filter the Completed event
	 */
	else if ((event['detail-type'] as string) === RESULTS_COMPLETED_EVENT && [SCHEDULER_EVENT_SOURCE, ENGINE_EVENT_SOURCE, RESULTS_EVENT_SOURCE].includes(event['source'])) {
		await eventProcessor.processCompletedEvent(event as unknown as ResultsChangeEvent);
	}
	/**
	 * Filter the Failed event
	 */
	else if ((event['detail-type'] as string) === RESULTS_FAILED_EVENT && [SCHEDULER_EVENT_SOURCE, ENGINE_EVENT_SOURCE, RESULTS_EVENT_SOURCE].includes(event['source'])) {
		await eventProcessor.processFailedEvent(event as unknown as ResultsChangeEvent);
	}
	else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}
	app.log.info(`EventBridgeLambda > handler >exit`);

};

type EventDetails = ResultsChangeEvent | GroupChangeEvent | RegionChangeEvent;

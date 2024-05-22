import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import {
	DomainEvent,
	RESULTS_EVENT_SOURCE,
	RESULTS_RESULT_CREATED_EVENT,
	RESULTS_RESULT_UPDATED_EVENT
} from "@arcade/events";
import { RegionsClient, ResultResource } from "@arcade/clients";
import ow from 'ow';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const regionsClient = di.resolve<RegionsClient>('regionsClient');

export const handler: EventBridgeHandler<any, DomainEvent<ResultResource>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	if ([RESULTS_RESULT_UPDATED_EVENT, RESULTS_RESULT_CREATED_EVENT].includes(event["detail-type"]) && event['source'] === RESULTS_EVENT_SOURCE) {

		ow(event, ow.object.nonEmpty)
		ow(event.detail, ow.object.nonEmpty)
		ow(event.detail.new, ow.object.partialShape(
			{
				id: ow.string.nonEmpty,
				status: ow.string.nonEmpty,
				createdAt: ow.string.nonEmpty,
				message: ow.optional.string
			}
		))

		const result = event.detail.new;
		const securityContext = {
			authorizer: {
				claims: {
					email: 'results',
					'custom:role': '/|||contributor',
				},
			}
		};

		// update the region resource tag with execution information
		await regionsClient.updateRegion(result.regionId, {
			tags: {
				'arcade:results:id': result.id,
				'arcade:results:status': result.status,
				'arcade:results:message': result.message,
				'arcade:results:createdAt': result.createdAt,
				'arcade:results:updatedAt': result.updatedAt,
			}
		}, securityContext);
	}

	app.log.info(`EventBridgeLambda> handler> exit`);
};

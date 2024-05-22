import type { Callback, Context, SQSHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { DomainEvent } from "@arcade/events";
import { AggregatorService } from "./aggregator/service.js";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const aggregatorService = di.resolve<AggregatorService>('aggregatorService');

export const handler: SQSHandler = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`SQSLambda > handler > event: ${JSON.stringify(event)}`);

	await Promise.all([
		// Aggregate the polygon resources for region
		aggregatorService.aggregatePolygons(event.Records.map(o => JSON.parse(o.body))
			.filter((o: DomainEvent<any>) => o.resourceType === 'Polygon')),
		// Aggregate the polygon region resources for group
		aggregatorService.aggregateRegions(event.Records.map(o => JSON.parse(o.body))
			.filter((o: DomainEvent<any>) => o.resourceType === 'Region'))
	])

	app.log.info(`SQSLambda > handler >exit`);
};


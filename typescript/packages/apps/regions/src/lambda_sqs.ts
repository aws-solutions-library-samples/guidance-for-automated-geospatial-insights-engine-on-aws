/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

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


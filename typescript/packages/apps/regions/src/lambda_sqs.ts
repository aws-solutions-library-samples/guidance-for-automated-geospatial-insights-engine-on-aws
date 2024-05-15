import type { Callback, Context, SQSHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { DomainEvent } from "@arcade/events";
import { Polygon } from "./api/polygons/schemas.js";
import { RegionService } from "./api/regions/service.js";
import { Region } from "./api/regions/schemas.js";
import { GroupService } from "./api/groups/service.js";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const regionService = di.resolve<RegionService>('regionService');
const groupService = di.resolve<GroupService>('groupService');

export const handler: SQSHandler = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`SQSLambda > handler > event: ${JSON.stringify(event)}`);

	const regionEvents = event.Records.map(o => JSON.parse(o.body))
		.filter((o: DomainEvent<any>) => o.resourceType === 'Region')
		.reduce((previousValue, currentValue: DomainEvent<Region>) => {
			const groupId = currentValue?.new?.groupId ?? currentValue?.old?.groupId
			if (!previousValue?.[groupId]) {
				previousValue[groupId] = { totalRegionsDelta: 0, totalAreaDelta: 0 }
			}
			if (currentValue.eventType === 'created') {
				previousValue[groupId].totalRegionsDelta++;
				previousValue[groupId].totalAreaDelta += currentValue.new.totalArea;
			}
			if (currentValue.eventType === 'deleted') {
				previousValue[groupId].totalRegionsDelta--
				previousValue[groupId].totalAreaDelta -= currentValue.old.totalArea
			}
			if (currentValue.eventType === 'updated') {
				previousValue[groupId].totalAreaDelta += (currentValue.new.totalArea - currentValue.old.totalArea)
			}
			return previousValue;
		}, {});

	const polygonEvents = event.Records.map(o => JSON.parse(o.body))
		.filter((o: DomainEvent<any>) => o.resourceType === 'Polygon')
		.reduce((previousValue, currentValue: DomainEvent<Polygon>) => {
			const regionId = currentValue?.new?.regionId ?? currentValue?.old?.regionId
			if (!previousValue?.[regionId]?.totalAreaDelta) {
				previousValue[regionId] = { totalAreaDelta: 0, totalPolygonsDelta: 0 }
			}
			if (currentValue.eventType === 'created') {
				previousValue[regionId].totalPolygonsDelta++;
				previousValue[regionId].totalAreaDelta += currentValue.new.area
			}
			if (currentValue.eventType === 'deleted') {
				previousValue[regionId].totalPolygonsDelta--;
				previousValue[regionId].totalAreaDelta -= currentValue.old.area
			}
			if (currentValue.eventType === 'updated') {
				previousValue[regionId].totalAreaDelta += (currentValue.new.area - currentValue.old.area)
			}
			return previousValue;
		}, {});


	for (const [key, value] of Object.entries(polygonEvents)) {
		await regionService.updateAggregatedPolygonsAttributes(key, { totalAreaDelta: value['totalAreaDelta'] as number, totalPolygonsDelta: value['totalPolygonsDelta'] })
	}

	for (const [key, value] of Object.entries(regionEvents)) {
		await groupService.updateAggregatedRegionsAttributes(key, { totalAreaDelta: value['totalAreaDelta'] as number, totalRegionsDelta: value['totalRegionsDelta'] as number })
	}

	app.log.info(`SQSLambda > handler >exit`);
};


import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from 'vitest-mock-extended';
import { AggregatorService } from "./service.js";
import pino from "pino";
import { DomainEvent } from "@arcade/events";
import { Polygon } from "../api/polygons/schemas.js";
import { Region } from "../api/regions/schemas.js";
import { bbox, polygon } from "@turf/turf";
import { RegionService } from "../api/regions/service.js";
import { GroupService } from "../api/groups/service.js";

describe('AggregatorService', () => {
	let aggregatorService: AggregatorService;
	let mockRegionService: MockProxy<RegionService> = mock<RegionService>();
	let mockGroupService: MockProxy<GroupService> = mock<GroupService>();

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';
		mockRegionService.get.mockReset();
		mockRegionService.updateAggregatedPolygonsAttributes.mockReset();
		aggregatorService = new AggregatorService(logger, mockRegionService, mockGroupService)
	})

	it('should set the region bbox to the polygon bbox', async () => {
		mockRegionService.get.mockResolvedValue({} as Region)
		await aggregatorService.aggregatePolygons([polygonEvent1]);
		expect(mockRegionService.updateAggregatedPolygonsAttributes).toBeCalledWith('region-1', {
			boundingBox: [
				-72.4495876,
				42.9065491,
				-72.4481285,
				42.9080108,
			],
			totalAreaDelta: 20,
			totalPolygonsDelta: 1
		})
	});

	it('should set the region bbox to the total bounding box of all polygons associated with a region', async () => {
		mockRegionService.get.mockResolvedValue({} as Region)
		await aggregatorService.aggregatePolygons([polygonEvent1, polygonEvent2, polygonEvent3]);


		expect(mockRegionService.updateAggregatedPolygonsAttributes).toBeCalledWith('region-1', {
			boundingBox: [
				-72.4524415,
				42.9041758,
				-72.4481285,
				42.9080108,
			],
			totalAreaDelta: 30,
			totalPolygonsDelta: 2
		})

		expect(mockRegionService.updateAggregatedPolygonsAttributes).toBeCalledWith('region-2', {
			boundingBox: [
				-72.4483377,
				42.9027258,
				-72.4465191,
				42.9037868,
			],
			totalAreaDelta: 10,
			totalPolygonsDelta: 1
		})
	});

	it('should set the region bbox to combination of current bbox and polygon bbox', async () => {
		const regionBoundingBox = bbox(polygon([
			[
				[
					-72.4523878,
					42.9075393
				],
				[
					-72.4505103,
					42.9075314
				],
				[
					-72.4504459,
					42.9041758
				],
				[
					-72.4524415,
					42.9041994
				],
				[
					-72.4523878,
					42.9075393
				],
			]
		]));
		mockRegionService.get.mockResolvedValue({ boundingBox: regionBoundingBox } as Region)
		await aggregatorService.aggregatePolygons([polygonEvent1]);
		expect(mockRegionService.updateAggregatedPolygonsAttributes).toBeCalledWith('region-1', {
			boundingBox: [
				-72.4524415,
				42.9041758,
				-72.4481285,
				42.9080108,
			],
			totalAreaDelta: 20,
			totalPolygonsDelta: 1
		})
	});
});


const polygonEvent1: DomainEvent<Polygon> =
	{
		eventType: 'created',
		new: {
			id: "polygon-1",
			name: "region-name-1",
			regionId: "region-1",
			boundary: [[[
				[
					-72.4493408,
					42.9080108
				],
				[
					-72.4481392,
					42.9079715
				],
				[
					-72.4481285,
					42.9066513
				],
				[
					-72.4495876,
					42.9065491
				],
				[
					-72.4493408,
					42.9080108
				],
			]]],
			groupId: "group-1",
			area: 20,
			createdBy: "",
			createdAt: ""
		},
		resourceType: "Polygon",
		id: "polygon-1"
	}

const polygonEvent2: DomainEvent<Polygon> =
	{
		eventType: 'created',
		new: {
			id: "polygon-2",
			name: "region-name-1",
			regionId: "region-1",
			boundary: [[[
				[
					-72.4523878,
					42.9075393
				],
				[
					-72.4505103,
					42.9075314
				],
				[
					-72.4504459,
					42.9041758
				],
				[
					-72.4524415,
					42.9041994
				],
				[
					-72.4523878,
					42.9075393
				],
			]]],
			groupId: "group-1",
			area: 10,
			createdBy: "",
			createdAt: ""
		},
		resourceType: "Polygon",
		id: "polygon-1"
	}

const polygonEvent3: DomainEvent<Polygon> =
	{
		eventType: 'created',
		new: {
			id: "polygon-3",
			name: "region-name-2",
			regionId: "region-2",
			boundary: [[[
				[
					-72.4483377,
					42.9037868
				],
				[
					-72.4466532,
					42.9037671
				],
				[
					-72.4465191,
					42.9027808
				],
				[
					-72.4481714,
					42.9027258
				],
				[
					-72.4483377,
					42.9037868
				],
			]]],
			groupId: "group-1",
			area: 10,
			createdBy: "",
			createdAt: ""
		},
		resourceType: "Polygon",
		id: "polygon-3"
	}

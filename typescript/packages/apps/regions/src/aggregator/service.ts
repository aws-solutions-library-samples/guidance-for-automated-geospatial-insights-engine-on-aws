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

import { DomainEvent } from "@agie/events";
import { Polygon } from "../api/polygons/schemas.js";
import { FastifyBaseLogger } from "fastify";
import { BBox, bbox, bboxPolygon, multiPolygon, union } from "@turf/turf";
import { RegionService } from "../api/regions/service.js";
import { SecurityContext, SecurityScope } from "../common/scopes.js";
import { Region } from "../api/regions/schemas.js";
import { GroupService } from "../api/groups/service.js";


interface AggregatedGroupParameter {
	totalAreaDelta: number;
	totalRegionsDelta: number;
}

interface AggregatedGroupParameterMap {
	[groupId: string]: AggregatedGroupParameter
}


interface AggregatedRegionParameter {
	totalAreaDelta: number;
	totalPolygonsDelta: number;
	boundingBox: BBox | undefined;
}


interface AggregatedRegionParameterMap {
	[regionId: string]: AggregatedRegionParameter
}

export class AggregatorService {
	readonly securityContext: SecurityContext;

	constructor(readonly log: FastifyBaseLogger, readonly regionService: RegionService, readonly groupService: GroupService) {
		this.securityContext = {
			email: "AggregatorService",
			role: SecurityScope.contributor,
			phoneNumber: "",
			sub: ""
		};
	}


	public async aggregateRegions(domainEvents: DomainEvent<Region>[]): Promise<void> {
		this.log.debug(`AggregatorService> aggregateRegions> in> domainEvents: ${JSON.stringify(domainEvents)}`)

		const aggregatedGroupParameterMap: AggregatedGroupParameterMap = {};

		for (const domainEvent of domainEvents) {
			const groupId = domainEvent?.new?.groupId ?? domainEvent?.old?.groupId
			if (!aggregatedGroupParameterMap?.[groupId]) {
				aggregatedGroupParameterMap[groupId] = { totalRegionsDelta: 0, totalAreaDelta: 0 }
			}
			if (domainEvent.eventType === 'created') {
				aggregatedGroupParameterMap[groupId].totalRegionsDelta++;
				aggregatedGroupParameterMap[groupId].totalAreaDelta += domainEvent.new.totalArea;
			}
			if (domainEvent.eventType === 'deleted') {
				aggregatedGroupParameterMap[groupId].totalRegionsDelta--
				aggregatedGroupParameterMap[groupId].totalAreaDelta -= domainEvent.old.totalArea
			}
			if (domainEvent.eventType === 'updated') {
				aggregatedGroupParameterMap[groupId].totalAreaDelta += (domainEvent.new.totalArea - domainEvent.old.totalArea)
			}
		}

		for (const [groupId, aggregatedGroupParameter] of Object.entries(aggregatedGroupParameterMap)) {
			await this.groupService.updateAggregatedRegionsAttributes(groupId, {
				totalAreaDelta: aggregatedGroupParameter.totalAreaDelta,
				totalRegionsDelta: aggregatedGroupParameter.totalRegionsDelta
			})
		}

		this.log.debug(`AggregatorService> aggregateRegions> exit>`)
	}

	public async aggregatePolygons(domainEvents: DomainEvent<Polygon>[]) {
		this.log.debug(`AggregatorService> aggregatePolygons> in> domainEvents: ${JSON.stringify(domainEvents)}`)

		const aggregateParameterByRegion: AggregatedRegionParameterMap = {};

		const calculateBbox: BBox = (newBoundary: number[][][][], existingBBox: BBox): BBox => {
			let combinedPolygon = multiPolygon(newBoundary);
			if (existingBBox) {
				combinedPolygon = union(combinedPolygon, bboxPolygon(existingBBox));
			}
			return bbox(combinedPolygon);
		}

		for (const domainEvent of domainEvents) {
			const regionId = domainEvent?.new?.regionId ?? domainEvent?.old?.regionId

			if (!aggregateParameterByRegion?.[regionId]?.totalAreaDelta) {
				const region = await this.regionService.get(this.securityContext, regionId);
				aggregateParameterByRegion[regionId] = { totalAreaDelta: 0, totalPolygonsDelta: 0, boundingBox: region.boundingBox }
			}
			if (domainEvent.eventType === 'created') {
				aggregateParameterByRegion[regionId].totalPolygonsDelta++;
				aggregateParameterByRegion[regionId].totalAreaDelta += domainEvent.new.area
				aggregateParameterByRegion[regionId].boundingBox = calculateBbox(domainEvent.new.boundary, aggregateParameterByRegion[regionId].boundingBox);
			}

			if (domainEvent.eventType === 'deleted') {
				aggregateParameterByRegion[regionId].totalPolygonsDelta--;
				aggregateParameterByRegion[regionId].totalAreaDelta -= domainEvent.old.area
			}

			if (domainEvent.eventType === 'updated') {
				aggregateParameterByRegion[regionId].totalAreaDelta += (domainEvent.new.area - domainEvent.old.area)
				aggregateParameterByRegion[regionId].boundingBox = calculateBbox(domainEvent.new.boundary, aggregateParameterByRegion[regionId].boundingBox);
			}
		}

		for (const [regionId, aggregatedParameter] of Object.entries(aggregateParameterByRegion)) {
			await this.regionService.updateAggregatedPolygonsAttributes(regionId, {
				totalAreaDelta: aggregatedParameter.totalAreaDelta,
				totalPolygonsDelta: aggregatedParameter.totalPolygonsDelta,
				boundingBox: aggregatedParameter.boundingBox
			})
		}

		this.log.debug(`AggregatorService> aggregatePolygons> exit> domainEvents: ${JSON.stringify(domainEvents)}`)
	}
}

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

import { EventPublisher } from '@agie/events';
import { SecurityContext } from '@agie/rest-api-authorizer';
import { area, multiPolygon, polygon } from '@turf/turf';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { InvalidRequestError, InvalidStateError, NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { RegionService } from '../regions/service.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { PolygonRepository } from './repository.js';
import { CreatePolygon, EditPolygon, Polygon } from './schemas.js';

export type PolygonListFilterOptions = TagFilterOptions & {
	name?: string;
	groupId?: string;
	regionId?: string;
	includeLatestState?: boolean;
};
const RESERVED_FIELDS_AS_TAGS = ['name', 'groupId', 'regionId'];
const SQMT_TO_ACRES = 0.000247105;

export class PolygonService {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly polygonRepository: PolygonRepository,
		readonly regionService: RegionService,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository,
		readonly eventPublisher: EventPublisher
	) {}

	public async create(securityContext: SecurityContext, regionId: string, polygon: CreatePolygon): Promise<Polygon> {
		this.log.debug(`PolygonService> create> regionId:${regionId}, polygon:${JSON.stringify(polygon)}`);

		// Validation
		ow(regionId, ow.string.nonEmpty);
		ow(
			polygon,
			ow.object.exactShape({
				name: ow.string.nonEmpty,
				boundary: ow.array.nonEmpty,
				exclusions: ow.optional.array,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);
		this.validatePolygons(polygon);

		// ensure parent region exists (will throw error if not exist or insufficient privileges)
		const region = await this.regionService.get(securityContext, regionId);

		// construct what we're saving
		const toSave = this.commonService.prepareResourceForCreate<CreatePolygon, Polygon>(polygon, RESERVED_FIELDS_AS_TAGS, {
			regionId,
			groupId: region.groupId,
			createdBy: securityContext.email,
		});

		this.calculateArea(toSave);

		// save
		await this.polygonRepository.create(toSave);

		const saved = await this.get(securityContext, toSave.id);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'created',
			id: saved.id,
			resourceType: 'Polygon',
			new: toSave,
		});

		this.log.debug(`PolygonService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	private calculateArea(polygonResource: Polygon) {
		try {
			let areaSqMt = area(multiPolygon(polygonResource.boundary));
			polygonResource.exclusions?.forEach((p) => {
				// TODO This approach does not take into consideration overlapping of exclusion boundaries.
				const exclusionArea = area([polygon(p)]);
				areaSqMt -= exclusionArea;
			});
			polygonResource.area = areaSqMt * SQMT_TO_ACRES;
		} catch (e) {
			throw new InvalidRequestError(`Unable to calculate area: ${e.message}`);
		}
	}

	private validatePolygons(polygon: CreatePolygon | EditPolygon): void {
		polygon.boundary.forEach((b1) => {
			b1.forEach((b2) => {
				b2.forEach((coordinate) => {
					ow(coordinate, ow.array.exactShape([ow.number.inRange(-180.0, 180.0), ow.number.inRange(-90.0, 90.0)]));
				});
			});
		});

		polygon.exclusions?.forEach((polygon) => {
			polygon.forEach((coordinate) => {
				ow(coordinate, ow.array.exactShape([ow.number.inRange(-180.0, 180.0), ow.number.inRange(-90.0, 90.0)]));
			});
		});
	}

	public async update(securityContext: SecurityContext, id: string, polygon: EditPolygon): Promise<Polygon> {
		this.log.debug(`PolygonService> update> id:${id}, polygon:${JSON.stringify(polygon)}`);

		// Validation
		ow(
			polygon,
			ow.object.exactShape({
				name: ow.optional.string,
				boundary: ow.optional.array,
				exclusions: ow.optional.array,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);
		this.validatePolygons(polygon);

		// retrieve existing
		const existing = await this.get(securityContext, id);

		// merge the existing and to be updated
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditPolygon, Polygon>(existing, polygon, ['name'], securityContext.email);

		this.calculateArea(merged);

		// save
		await this.polygonRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);

		const saved = await this.get(securityContext, merged.id);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'updated',
			id: merged.id,
			resourceType: 'Polygon',
			old: existing,
			new: saved,
		});

		this.log.debug(`PolygonService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async get(securityContext: SecurityContext, id: string): Promise<Polygon> {
		this.log.debug(`PolygonService> get> in: id:${id}}`);

		// retrieve
		const polygon = await this.polygonRepository.get(id);
		if (polygon === undefined) {
			throw new NotFoundError(`Polygon '${id}' not found.`);
		}

		this.log.debug(`PolygonService> get> exit:${JSON.stringify(polygon)}`);
		return polygon;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`PolygonService> delete> id:${id}`);

		// check exists
		const existing = await this.get(securityContext, id);

		// ensure no states are associated with the polygon
		const states = await this.commonService.listResourceIdsByTag(PkType.State, { count: 1, tags: { ___polygonId: id } });
		if ((states[0]?.length ?? 0) > 0) {
			throw new InvalidStateError(`Polygon '${id}' cannot be deleted as it still has associated states.`);
		}

		// delete the polygon
		await this.polygonRepository.delete(id);

		// publish event
		await this.eventPublisher.publishEvent({
			eventType: 'deleted',
			id: existing.id,
			resourceType: 'Polygon',
			old: existing,
		});

		this.log.debug(`PolygonService> delete> exit:`);
	}

	public async list(securityContext: SecurityContext, options: PolygonListFilterOptions): Promise<[Polygon[], ResourceId]> {
		this.log.debug(`PolygonService> list> in> options:${JSON.stringify(options)}`);

		// if name, groupId, or regionId are being filtered, add as reserved tag searches
		for (const tag of RESERVED_FIELDS_AS_TAGS) {
			if (options[tag]) {
				const tagKey = `${RESERVED_PREFIX}${tag}`;
				options.tags = { ...options.tags, [tagKey]: options[tag] };
			}
		}

		let polygons: Polygon[] = [];
		let polygonIds: string[];
		let paginationKey: ResourceId;

		if ((Object.keys(options.tags).length ?? 0) == 0) {
			[polygonIds, paginationKey] = await this.commonRepository.listResourceIds(PkType.Polygon, options);
		} else {
			[polygonIds, paginationKey] = await this.commonService.listResourceIdsByTag(PkType.Polygon, options);
		}
		polygons = await this.polygonRepository.listByIds(polygonIds, options.includeLatestState);

		this.log.debug(`PolygonService> list> exit:${JSON.stringify([polygons, paginationKey])}`);
		return [polygons, paginationKey];
	}
}

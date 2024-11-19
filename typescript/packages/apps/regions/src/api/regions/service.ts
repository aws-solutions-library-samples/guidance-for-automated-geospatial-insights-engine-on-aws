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

import { EnginesClient, LambdaRequestContext } from '@agie/clients';
import { EventPublisher } from '@agie/events';
import { SecurityContext } from '@agie/rest-api-authorizer';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { ICommonCache } from '../../common/cache.js';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { InvalidStateError, NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { GroupService } from '../groups/service.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { RegionRepository } from './repository.js';
import { CreateRegion, EditRegion, ProcessingConfig, Region, UpdateAggregatedPolygonsParameter } from './schemas.js';

export type RegionListFilterOptions = TagFilterOptions & {
	name?: string;
	groupId?: string;
};
const RESERVED_FIELDS_AS_TAGS = ['name', 'groupId'];

export class RegionService {
	private readonly context: LambdaRequestContext;

	public constructor(
		readonly log: FastifyBaseLogger,
		readonly regionRepository: RegionRepository,
		readonly groupService: GroupService,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository,
		readonly eventPublisher: EventPublisher,
		readonly regionCache: ICommonCache<Region>,
		readonly enginesClient: EnginesClient
	) {
		this.context = {
			authorizer: {
				claims: {
					email: 'regions',
					'custom:role': 'reader',
				},
			},
		};
	}

	public async create(securityContext: SecurityContext, groupId: string, region: CreateRegion): Promise<Region> {
		this.log.debug(`RegionService> create> groupId:${groupId}, region:${JSON.stringify(region)}`);

		// Validation
		ow(groupId, ow.string.nonEmpty);
		ow(
			region,
			ow.object.exactShape({
				name: ow.string.nonEmpty,
				processingConfig: ow.object.nonEmpty,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// validate the processing configuration
		if (region.processingConfig) {
			await this.validateProcessingConfig(region.processingConfig);
		}

		// ensure parent group exists (will throw error if not exist or insufficient privileges)
		await this.groupService.get(securityContext, groupId);

		const toSave = this.commonService.prepareResourceForCreate<CreateRegion, Region>(region, RESERVED_FIELDS_AS_TAGS, { groupId, createdBy: securityContext.email });
		toSave.totalArea = 0;
		toSave.totalPolygons = 0;

		// save
		await this.regionRepository.create(toSave);
		const saved = await this.get(securityContext, toSave.id);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'created',
			id: saved.id,
			resourceType: 'Region',
			new: saved,
		});

		// return
		this.log.debug(`RegionService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async updateAggregatedPolygonsAttributes(id: string, updateParameter: UpdateAggregatedPolygonsParameter): Promise<void> {
		this.log.debug(`RegionService> updateAggregatedPolygonsAttributes> id:${id}, updateParameter:${JSON.stringify(updateParameter)}`);
		ow(
			updateParameter,
			ow.object.exactShape({
				totalAreaDelta: ow.number.not.infinite,
				totalPolygonsDelta: ow.number.not.infinite,
				boundingBox: ow.object.nonEmpty,
			})
		);
		// retrieve existing
		const existing = await this.regionRepository.get(id);
		if (existing) {
			const updated = await this.regionRepository.updateAggregatedAttribute(id, updateParameter);
			await this.regionCache.set(id, updated);
			// publish the event
			await this.eventPublisher.publishEvent({
				eventType: 'updated',
				id: updated.id,
				resourceType: 'Region',
				old: existing,
				new: updated,
			});
		}
		this.log.debug(`RegionService> updateAggregatedPolygonsAttributes> exit>`);
	}

	public async update(securityContext: SecurityContext, id: string, region: EditRegion): Promise<Region> {
		this.log.debug(`RegionService> update> id:${id}, region:${JSON.stringify(region)}`);

		// Validation
		ow(
			region,
			ow.object.exactShape({
				name: ow.optional.string,
				processingConfig: ow.optional.object,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// retrieve existing
		const existing = await this.get(securityContext, id);

		if (region.processingConfig) {
			await this.validateProcessingConfig(region.processingConfig);
		}

		// merge the existing and to be updated
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditRegion, Region>(existing, region, ['name'], securityContext.email);

		// save
		await this.regionRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);

		const saved = await this.get(securityContext, merged.id, false);
		await this.regionCache.set(saved.id, saved);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'updated',
			id: merged.id,
			resourceType: 'Region',
			old: existing,
			new: saved,
		});

		this.log.debug(`RegionService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async get(securityContext: SecurityContext, id: string, useCache = true): Promise<Region> {
		this.log.debug(`RegionService> get> in: id:${id}`);

		let region: Region;
		if (useCache) {
			region = await this.regionCache.get(id);
			// if region exists in cache return the cached version
			if (region) return region;
		}

		// else retrieve from DynamoDB
		region = await this.regionRepository.get(id);
		if (region === undefined) {
			throw new NotFoundError(`Region '${id}' not found.`);
		}
		// insert the DynamoDB resource to cache
		await this.regionCache.set(id, region);

		this.log.debug(`RegionService> get> exit:${JSON.stringify(region)}`);
		return region;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`RegionService> delete> id:${id}`);

		// check exists
		const existing = await this.get(securityContext, id);

		// ensure no polygons are associated with the region
		const polygons = await this.commonService.listResourceIdsByTag(PkType.Polygon, { count: 1, tags: { ___regionId: id } });
		if ((polygons[0]?.length ?? 0) > 0) {
			throw new InvalidStateError(`Region '${id}' cannot be deleted as it still has associated polygons.`);
		}

		// delete
		await Promise.all([this.regionRepository.delete(id), this.regionCache.delete(id)]);

		// publish event
		await this.eventPublisher.publishEvent({
			eventType: 'deleted',
			id: existing.id,
			resourceType: 'Region',
			old: existing,
		});

		this.log.debug(`RegionService> delete> exit:`);
	}

	public async list(securityContext: SecurityContext, options: RegionListFilterOptions): Promise<[Region[], ResourceId]> {
		this.log.debug(`RegionService> list> in> options:${JSON.stringify(options)}`);

		// if name or groupId are being filtered, add as reserved tag searches
		for (const tag of RESERVED_FIELDS_AS_TAGS) {
			if (options[tag]) {
				const tagKey = `${RESERVED_PREFIX}${tag}`;
				options.tags = { ...options.tags, [tagKey]: options[tag] };
			}
		}

		let regions: Region[] = [];
		let regionIds: string[];
		let paginationKey: ResourceId;

		if ((Object.keys(options.tags).length ?? 0) == 0) {
			[regionIds, paginationKey] = await this.commonRepository.listResourceIds(PkType.Region, options);
		} else {
			[regionIds, paginationKey] = await this.commonService.listResourceIdsByTag(PkType.Region, options);
		}
		regions = await this.regionRepository.listByIds(regionIds);

		this.log.debug(`RegionService> list> exit:${JSON.stringify([regions, paginationKey])}`);
		return [regions, paginationKey];
	}

	private async validateProcessingConfig(config: ProcessingConfig) {
		switch (config.mode) {
			case 'scheduled':
				ow.object.exactShape({
					mode: ow.string.nonEmpty,
					scheduleExpression: ow.string.nonEmpty,
					scheduleExpressionTimezone: ow.optional.string,
					priority: ow.string.nonEmpty,
				});
				break;
			case 'onNewScene':
				ow.object.exactShape({
					mode: ow.string.nonEmpty,
					priority: ow.string.nonEmpty,
				});
				break;
			case 'disabled':
				ow.object.exactShape({
					mode: ow.string.nonEmpty,
				});
				break;
		}

		// This will throws exception if engine does not exists
		if (config.engineId) {
			await this.enginesClient.get(config.engineId, this.context);
		}
	}
}

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
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { InvalidStateError, NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { GroupRepository } from './repository.js';
import { CreateGroup, EditGroup, Group, UpdateAggregatedRegionsParameter } from './schemas.js';

export type GroupListFilterOptions = TagFilterOptions & {
	name?: string;
};
const RESERVED_AS_TAGS = ['name'];

export class GroupService {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly groupRepository: GroupRepository,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository,
		readonly eventPublisher: EventPublisher
	) {}

	public async create(securityContext: SecurityContext, group: CreateGroup): Promise<Group> {
		this.log.debug(`GroupService> create> group:${JSON.stringify(group)}`);

		// Validation
		ow(
			group,
			ow.object.exactShape({
				name: ow.string.nonEmpty,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		const toSave = this.commonService.prepareResourceForCreate<CreateGroup, Group>(group, RESERVED_AS_TAGS, { createdBy: securityContext.email });
		toSave.totalRegions = 0;
		toSave.totalArea = 0;

		// save
		await this.groupRepository.create(toSave);

		// return
		const saved = await this.get(securityContext, toSave.id);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'created',
			id: saved.id,
			resourceType: 'Group',
			new: saved,
		});

		// return
		this.log.debug(`GroupService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async updateAggregatedRegionsAttributes(id: string, updateParameter: UpdateAggregatedRegionsParameter): Promise<void> {
		this.log.debug(`RegionService> updateAggregatedRegionsAttributes> id:${id}, updateParameter:${JSON.stringify(updateParameter)}`);
		ow(
			updateParameter,
			ow.object.exactShape({
				totalAreaDelta: ow.number.not.infinite,
				totalRegionsDelta: ow.number.not.infinite,
			})
		);
		// retrieve existing
		const existing = await this.groupRepository.get(id);
		if (existing) {
			const updated = await this.groupRepository.updateAggregatedAttribute(id, updateParameter);
			// publish the event
			await this.eventPublisher.publishEvent({
				eventType: 'updated',
				id: updated.id,
				resourceType: 'Group',
				old: existing,
				new: updated,
			});
		}
		this.log.debug(`RegionService> updateAggregatedRegionsAttributes> exit>`);
	}

	public async update(securityContext: SecurityContext, id: string, group: EditGroup): Promise<Group> {
		this.log.debug(`GroupService> update> id:${id}, group:${JSON.stringify(group)}`);

		// Validation
		ow(
			group,
			ow.object.exactShape({
				name: ow.optional.string,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// retrieve existing
		const existing = await this.get(securityContext, id);

		// merge the existing and to be updated
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditGroup, Group>(existing, group, RESERVED_AS_TAGS, securityContext.email);

		// save
		await this.groupRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);
		const saved = await this.get(securityContext, merged.id);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'updated',
			id: merged.id,
			resourceType: 'Group',
			old: existing,
			new: saved,
		});

		this.log.debug(`GroupService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`GroupService> delete> id:${id}`);

		// check exists
		const existing = await this.get(securityContext, id);

		// ensure no regions are associated with the group
		const regions = await this.commonService.listResourceIdsByTag(PkType.Region, { count: 1, tags: { ___groupId: id } });
		if (regions[0]?.length > 0) {
			throw new InvalidStateError(`Group '${id}' cannot be deleted as it still has associated regions.`);
		}

		// delete
		await this.groupRepository.delete(id);

		// publish event
		await this.eventPublisher.publishEvent({
			eventType: 'deleted',
			id: existing.id,
			resourceType: 'Group',
			old: existing,
		});

		this.log.debug(`GroupService> delete> exit:`);
	}

	public async get(securityContext: SecurityContext, id: string): Promise<Group> {
		this.log.debug(`GroupService> get> in: id:${id}`);

		// retrieve
		const group = await this.groupRepository.get(id);
		if (group === undefined) {
			throw new NotFoundError(`Group '${id}' not found.`);
		}

		this.log.debug(`GroupService> get> exit:${JSON.stringify(group)}`);
		return group;
	}

	public async list(securityContext: SecurityContext, options: GroupListFilterOptions): Promise<[Group[], ResourceId]> {
		this.log.debug(`GroupService> list> in> options:${JSON.stringify(options)}`);

		// if name is being filtered, add that as a reserved tag search
		for (const tag of RESERVED_AS_TAGS) {
			if (options[tag]) {
				const tagKey = `${RESERVED_PREFIX}${tag}`;
				options.tags = { ...options.tags, [tagKey]: options[tag] };
			}
		}

		// pagination token is encoded before returning due to characters such as + being replaced with space, therefore decode before use
		if (options.token) {
			options.token = decodeURIComponent(options.token);
		}

		let groups: Group[] = [];
		let groupIds: string[];
		let paginationKey: ResourceId;

		if ((Object.keys(options.tags).length ?? 0) == 0) {
			[groupIds, paginationKey] = await this.commonRepository.listResourceIds(PkType.Group, options);
		} else {
			[groupIds, paginationKey] = await this.commonService.listResourceIdsByTag(PkType.Group, options);
		}
		groups = await this.groupRepository.listByIds(groupIds);

		this.log.debug(`GroupService> list> exit:${JSON.stringify([groups, paginationKey])}`);
		return [groups, paginationKey];
	}
}

import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { InvalidStateError, NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { SecurityContext } from '../../common/scopes.js';
import { GroupService } from '../groups/service.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { RegionRepository } from './repository.js';
import { CreateRegion, EditRegion, Region } from './schemas.js';

export type RegionListFilterOptions = TagFilterOptions & {
	name?: string;
	groupId?: string;
};
const RESERVED_FIELDS_AS_TAGS = ['name', 'groupId'];

export class RegionService {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly regionRepository: RegionRepository,
		readonly groupService: GroupService,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository
	) {}

	public async create(securityContext: SecurityContext, groupId: string, region: CreateRegion): Promise<Region> {
		this.log.debug(`RegionService> create> groupId:${groupId}, region:${JSON.stringify(region)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(groupId, ow.string.nonEmpty);
		ow(
			region,
			ow.object.exactShape({
				name: ow.string.nonEmpty,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// TODO: perform more detailed validation on attributes and tags

		// ensure parent group exists (will throw error if not exist or insufficient privileges)
		await this.groupService.get(securityContext, groupId);

		const toSave = this.commonService.prepareResourceForCreate<CreateRegion, Region>(region, RESERVED_FIELDS_AS_TAGS, { groupId, createdBy: securityContext.email });

		// save
		await this.regionRepository.create(toSave);

		// TODO: publish event

		// return
		const saved = await this.regionRepository.get(toSave.id);
		this.log.debug(`RegionService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async update(securityContext: SecurityContext, id: string, region: EditRegion): Promise<Region> {
		this.log.debug(`RegionService> update> id:${id}, region:${JSON.stringify(region)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(
			region,
			ow.object.exactShape({
				name: ow.optional.string,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// TODO: perform more detailed validation on attributes and tags

		// retrieve existing
		const existing = await this.get(securityContext, id);

		// merge the existing and to be updated
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditRegion, Region>(existing, region, RESERVED_FIELDS_AS_TAGS, securityContext.email);

		// save
		await this.regionRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);

		// TODO: publish event

		const saved = this.regionRepository.get(merged.id);
		this.log.debug(`RegionService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async get(securityContext: SecurityContext, id: string): Promise<Region> {
		this.log.debug(`RegionService> get> in: id:${id}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// retrieve
		const region = await this.regionRepository.get(id);
		if (region === undefined) {
			throw new NotFoundError(`Region '${id}' not found.`);
		}

		this.log.debug(`RegionService> get> exit:${JSON.stringify(region)}`);
		return region;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`RegionService> delete> id:${id}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// check exists
		await this.get(securityContext, id);

		// ensure no zones are associated with the region
		const zones = await this.commonService.listResourceIdsByTag(PkType.Zone, { count: 1, tags: { ___regionId: id } });
		if ((zones[0]?.length ?? 0) > 0) {
			throw new InvalidStateError(`Region '${id}' cannot be deleted as it still has associated zones.`);
		}

		// delete
		await this.regionRepository.delete(id);

		// TODO: publish event

		this.log.debug(`RegionService> delete> exit:`);
	}

	public async list(securityContext: SecurityContext, options: RegionListFilterOptions): Promise<[Region[], ResourceId]> {
		this.log.debug(`RegionService> list> in> options:${JSON.stringify(options)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

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
}

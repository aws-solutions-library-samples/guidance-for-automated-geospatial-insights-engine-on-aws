import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { InvalidStateError, NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { SecurityContext } from '../../common/scopes.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { GroupRepository } from './repository.js';
import { CreateGroup, EditGroup, Group } from './schemas.js';

export type GroupListFilterOptions = TagFilterOptions & {
	name?: string;
};
const RESERVED_AS_TAGS = ['name'];

export class GroupService {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly groupRepository: GroupRepository,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository
	) {}

	public async create(securityContext: SecurityContext, group: CreateGroup): Promise<Group> {
		this.log.debug(`GroupService> create> group:${JSON.stringify(group)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(
			group,
			ow.object.exactShape({
				name: ow.string.nonEmpty,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// TODO: perform more detailed validation on attributes and tags

		const toSave = this.commonService.prepareResourceForCreate<CreateGroup, Group>(group, RESERVED_AS_TAGS, { createdBy: securityContext.email });

		// save
		await this.groupRepository.create(toSave);

		// TODO: publish event

		// return
		const saved = await this.get(securityContext, toSave.id);
		this.log.debug(`GroupService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async update(securityContext: SecurityContext, id: string, group: EditGroup): Promise<Group> {
		this.log.debug(`GroupService> update> id:${id}, group:${JSON.stringify(group)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(
			group,
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
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditGroup, Group>(existing, group, RESERVED_AS_TAGS, securityContext.email);

		// save
		await this.groupRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);

		// TODO: publish event

		const saved = this.groupRepository.get(merged.id);
		this.log.debug(`GroupService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`GroupService> delete> id:${id}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// check exists
		await this.get(securityContext, id);

		// ensure no regions are associated with the group
		const regions = await this.commonService.listResourceIdsByTag(PkType.Region, { count: 1, tags: { ___groupId: id } });
		if (regions[0]?.length > 0) {
			throw new InvalidStateError(`Group '${id}' cannot be deleted as it still has associated regions.`);
		}

		// delete
		await this.groupRepository.delete(id);

		// TODO: publish event

		this.log.debug(`GroupService> delete> exit:`);
	}

	public async get(securityContext: SecurityContext, id: string): Promise<Group> {
		this.log.debug(`GroupService> get> in: id:${id}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

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

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

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

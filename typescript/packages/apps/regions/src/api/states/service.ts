import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { SecurityContext } from '../../common/scopes.js';
import { RegionService } from '../regions/service.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { ZoneService } from '../zones/service.js';
import { StateRepository } from './repository.js';
import { CreateState, EditState, State } from './schemas.js';

export type StateListFilterOptions = TagFilterOptions & {
	name?: string;
	groupId?: string;
	regionId?: string;
	zoneId?: string;
	latestOnly?: boolean;
};
const RESERVED_FIELDS_AS_TAGS = ['name', 'groupId', 'regionId', 'zoneId'];

export class StateService {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly stateRepository: StateRepository,
		readonly regionService: RegionService,
		readonly zoneService: ZoneService,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository
	) {}

	public async create(securityContext: SecurityContext, zoneId: string, state: CreateState): Promise<State> {
		this.log.debug(`StateService> create> in> zoneId:${zoneId}, state:${JSON.stringify(state)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(zoneId, ow.string.nonEmpty);
		ow(
			state,
			ow.object.exactShape({
				timestamp: ow.string.date,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// TODO: perform more detailed validation on attributes and tags

		// ensure parent zone exists (will throw error if not exist or insufficient privileges).
		const zoneFuture = this.zoneService.get(securityContext, zoneId);
		// obtain details of existing latest state for the zone
		const existingLatestStateFuture = this.getLatestState(securityContext, zoneId);
		const [zone, existingLatestState] = await Promise.all([zoneFuture, existingLatestStateFuture]);

		// construct what we're saving
		const region = await this.regionService.get(securityContext, zone.regionId);
		const toSave = this.commonService.prepareResourceForCreate<CreateState, State>(
			state,
			RESERVED_FIELDS_AS_TAGS,
			{
				zoneId,
				createdBy: securityContext.email,
			},
			{
				[`${RESERVED_PREFIX}regionId`]: region.id,
				[`${RESERVED_PREFIX}groupId`]: region.groupId,
			}
		);

		// save
		await this.stateRepository.create(toSave, existingLatestState);

		// TODO: publish event

		// return
		const saved = await this.stateRepository.get(toSave.id);
		this.log.debug(`StateService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	private async getLatestState(securityContext: SecurityContext, zoneId: string) {
		this.log.debug(`StateService> getLatestState> in> zoneId:${zoneId}`);
		const result = await this.commonService.listResourceIdsByTag(PkType.State, { tags: { ___zoneId: zoneId, ___isLatest: 'true' } });
		const existingLatestStateId = result?.[0]?.[0];
		const existingLatestState = existingLatestStateId ? await this.get(securityContext, existingLatestStateId) : undefined;
		this.log.debug(`StateService> getLatestState> exit> ${JSON.stringify(existingLatestState)}`);
		return existingLatestState;
	}

	public async update(securityContext: SecurityContext, id: string, state: EditState): Promise<State> {
		this.log.debug(`StateService> update> id:${id}, state:${JSON.stringify(state)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(
			state,
			ow.object.exactShape({
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);

		// TODO: perform more detailed validation on attributes and tags

		// retrieve existing
		const existing = await this.get(securityContext, id);

		// merge the existing and to be updated
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditState, State>(existing, state, RESERVED_FIELDS_AS_TAGS, securityContext.email);

		// save
		await this.stateRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);

		// TODO: publish event

		const saved = this.stateRepository.get(merged.id);
		this.log.debug(`StateService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async get(securityContext: SecurityContext, id: string): Promise<State> {
		this.log.debug(`StateService> get> in: id:${id}}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// retrieve
		const state = await this.stateRepository.get(id);
		if (state === undefined) {
			throw new NotFoundError(`State '${id}' not found.`);
		}

		this.log.debug(`StateService> get> exit:${JSON.stringify(state)}`);
		return state;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`StateService> delete> id:${id}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// check exists
		const state = await this.get(securityContext, id);

		// obtain details of existing latest state for the zone
		const existingLatestState = await this.getLatestState(securityContext, state.zoneId);

		// delete
		await this.stateRepository.delete(state, existingLatestState);

		// TODO: publish event

		this.log.debug(`StateService> delete> exit:`);
	}

	public async list(securityContext: SecurityContext, options: StateListFilterOptions): Promise<[State[], ResourceId]> {
		this.log.debug(`StateService> list> in> options:${JSON.stringify(options)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// if supported fields are being filtered, add as reserved tag searches
		for (const tag of RESERVED_FIELDS_AS_TAGS) {
			if (options[tag]) {
				const tagKey = `${RESERVED_PREFIX}${tag}`;
				options.tags = { ...options.tags, [tagKey]: options[tag] };
			}
		}

		// if latest only is selected, set the appropriate tag filter
		if (options.latestOnly === true) {
			options.tags = { ...options.tags, [`${RESERVED_PREFIX}isLatest`]: 'true' };
		}

		// // decode the token if provided
		// if (options.token) {
		// 	options.token = decodeURIComponent(options.token);
		// }

		let states: State[] = [];
		let stateIds: string[];
		let paginationKey: ResourceId;

		if ((Object.keys(options.tags).length ?? 0) == 0) {
			[stateIds, paginationKey] = await this.commonRepository.listResourceIds(PkType.State, options);
		} else {
			[stateIds, paginationKey] = await this.commonService.listResourceIdsByTag(PkType.State, options);
		}
		states = await this.stateRepository.listByIds(stateIds);

		this.log.debug(`StateService> list> exit:${JSON.stringify([states, paginationKey])}`);
		return [states, paginationKey];
	}
}

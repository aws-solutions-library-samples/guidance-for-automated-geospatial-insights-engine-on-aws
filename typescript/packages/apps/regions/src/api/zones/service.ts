import { EventPublisher } from '@arcade/events';
import { area, polygon } from '@turf/turf';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { RESERVED_PREFIX } from '../../common/ddbAttributes.util.js';
import { InvalidRequestError, InvalidStateError, NotFoundError } from '../../common/errors.js';
import { PkType } from '../../common/pkTypes.js';
import { SecurityContext } from '../../common/scopes.js';
import { RegionService } from '../regions/service.js';
import { CommonRepository, ResourceId } from '../repository.common.js';
import { CommonService, TagFilterOptions } from '../service.common.js';
import { ZoneRepository } from './repository.js';
import { CreateZone, EditZone, Zone } from './schemas.js';

export type ZoneListFilterOptions = TagFilterOptions & {
	name?: string;
	groupId?: string;
	regionId?: string;
	includeLatestState?: boolean;
};
const RESERVED_FIELDS_AS_TAGS = ['name', 'groupId', 'regionId'];
const SQMT_TO_ACRES = 0.000247105;

export class ZoneService {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly zoneRepository: ZoneRepository,
		readonly regionService: RegionService,
		readonly commonService: CommonService,
		readonly commonRepository: CommonRepository,
		readonly eventPublisher: EventPublisher
	) {
	}

	public async create(securityContext: SecurityContext, regionId: string, zone: CreateZone): Promise<Zone> {
		this.log.debug(`ZoneService> create> regionId:${regionId}, zone:${JSON.stringify(zone)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(regionId, ow.string.nonEmpty);
		ow(
			zone,
			ow.object.exactShape({
				name: ow.string.nonEmpty,
				boundary: ow.array.nonEmpty,
				exclusions: ow.optional.array,
				scheduleExpression: ow.optional.string,
				scheduleExpressionTimezone: ow.optional.string,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);
		this.validatePolygons(zone);

		// TODO: perform more detailed validation on attributes and tags

		// ensure parent region exists (will throw error if not exist or insufficient privileges)
		const region = await this.regionService.get(securityContext, regionId);

		// construct what we're saving
		const toSave = this.commonService.prepareResourceForCreate<CreateZone, Zone>(
			zone,
			RESERVED_FIELDS_AS_TAGS,
			{ regionId, createdBy: securityContext.email },
			{ [`${RESERVED_PREFIX}groupId`]: region.groupId }
		);
		try {
			let areaSqMt = area(polygon([toSave.boundary]));
			toSave.exclusions?.forEach((p) => {
				// TODO This approach does not take into consideration overlapping of exclusion boundaries.
				const exclusionArea = area([polygon(p)]);
				areaSqMt -= exclusionArea;
			});
			toSave.area = areaSqMt * SQMT_TO_ACRES;
		} catch (e) {
			throw new InvalidRequestError(`Unable to calculate area: ${e.message}`);
		}

		// save
		await this.zoneRepository.create(toSave);

		// return
		const saved = await this.zoneRepository.get(toSave.id);

		// TODO: publish the whole resource
		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'created',
			id: saved.id,
			resourceType: 'zones',
			new: {
				regionId: regionId,
				groupId: region.groupId,
				zoneId: saved.id,
				scheduleExpression: saved.scheduleExpression,
				scheduleExpressionTimezone: saved.scheduleExpressionTimezone,
				coordinates: saved.boundary,
				exclusions: saved.exclusions,
			},
		});

		this.log.debug(`ZoneService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	private validatePolygons(zone: CreateZone | EditZone): void {
		zone.boundary.forEach((coordinate) => {
			ow(coordinate, ow.array.exactShape([ow.number.inRange(-180.0, 180.0), ow.number.inRange(-90.0, 90.0)]));
		});
		zone.exclusions?.forEach((polygon) => {
			polygon.forEach((coordinate) => {
				ow(coordinate, ow.array.exactShape([ow.number.inRange(-180.0, 180.0), ow.number.inRange(-90.0, 90.0)]));
			});
		});
	}

	public async update(securityContext: SecurityContext, id: string, zone: EditZone): Promise<Zone> {
		this.log.debug(`ZoneService> update> id:${id}, zone:${JSON.stringify(zone)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// Validation
		ow(
			zone,
			ow.object.exactShape({
				name: ow.optional.string,
				boundary: ow.optional.array,
				exclusions: ow.optional.array,
				scheduleExpression: ow.optional.string,
				scheduleExpressionTimezone: ow.optional.string,
				attributes: ow.optional.object,
				tags: ow.optional.object,
			})
		);
		this.validatePolygons(zone);

		// TODO: perform more detailed validation on attributes and tags

		// retrieve existing
		const existing = await this.get(securityContext, id);

		// merge the existing and to be updated
		const [merged, tagDiff] = this.commonService.prepareResourceForUpdate<EditZone, Zone>(existing, zone, RESERVED_FIELDS_AS_TAGS, securityContext.email);

		// save
		await this.zoneRepository.update(merged, tagDiff.toPut, tagDiff.toDelete);

		// TODO: publish event

		const saved = this.zoneRepository.get(merged.id);

		// TODO: return changed in event
		// ensure parent region exists (will throw error if not exist or insufficient privileges)
		const region = await this.regionService.get(securityContext, existing.regionId);
		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'updated',
			id: merged.id,
			resourceType: 'zones',
			old: {
				regionId: existing.regionId,
				groupId: region.groupId,
				zoneId: existing.id,
				scheduleExpression: existing.scheduleExpression,
				scheduleExpressionTimezone: existing.scheduleExpressionTimezone,
				coordinates: existing.boundary,
				exclusions: existing.exclusions,
			},
			new: {
				regionId: existing.regionId,
				groupId: region.groupId,
				zoneId: merged.id,
				scheduleExpression: merged.scheduleExpression,
				scheduleExpressionTimezone: merged.scheduleExpressionTimezone,
				coordinates: merged.boundary,
				exclusions: merged.exclusions,
			},
		});

		this.log.debug(`ZoneService> update> exit:${JSON.stringify(saved)}`);
		return saved;
	}

	public async get(securityContext: SecurityContext, id: string): Promise<Zone> {
		this.log.debug(`ZoneService> get> in: id:${id}}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// retrieve
		const zone = await this.zoneRepository.get(id);
		if (zone === undefined) {
			throw new NotFoundError(`Zone '${id}' not found.`);
		}

		this.log.debug(`ZoneService> get> exit:${JSON.stringify(zone)}`);
		return zone;
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.debug(`ZoneService> delete> id:${id}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// check exists
		const existing = await this.get(securityContext, id);

		// ensure no states are associated with the zone
		const states = await this.commonService.listResourceIdsByTag(PkType.State, { count: 1, tags: { ___zoneId: id } });
		if ((states[0]?.length ?? 0) > 0) {
			throw new InvalidStateError(`Zone '${id}' cannot be deleted as it still has associated states.`);
		}

		// delete the zone
		await this.zoneRepository.delete(id);

		// get the region so we can populate the group id
		const region = await this.regionService.get(securityContext, existing.regionId);

		await this.eventPublisher.publishEvent({
			eventType: 'deleted',
			id: existing.id,
			resourceType: 'zones',
			old: {
				regionId: existing.regionId,
				groupId: region.groupId,
				zoneId: existing.id,
				scheduleExpression: existing.scheduleExpression,
				scheduleExpressionTimezone: existing.scheduleExpressionTimezone,
				coordinates: existing.boundary,
				exclusions: existing.exclusions,
			},
		});

		this.log.debug(`ZoneService> delete> exit:`);
	}

	public async list(securityContext: SecurityContext, options: ZoneListFilterOptions): Promise<[Zone[], ResourceId]> {
		this.log.debug(`ZoneService> list> in> options:${JSON.stringify(options)}`);

		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)

		// if name, groupId, or regionId are being filtered, add as reserved tag searches
		for (const tag of RESERVED_FIELDS_AS_TAGS) {
			if (options[tag]) {
				const tagKey = `${RESERVED_PREFIX}${tag}`;
				options.tags = { ...options.tags, [tagKey]: options[tag] };
			}
		}

		let zones: Zone[] = [];
		let zoneIds: string[];
		let paginationKey: ResourceId;

		if ((Object.keys(options.tags).length ?? 0) == 0) {
			[zoneIds, paginationKey] = await this.commonRepository.listResourceIds(PkType.Zone, options);
		} else {
			[zoneIds, paginationKey] = await this.commonService.listResourceIdsByTag(PkType.Zone, options);
		}
		zones = await this.zoneRepository.listByIds(zoneIds, options.includeLatestState);

		this.log.debug(`ZoneService> list> exit:${JSON.stringify([zones, paginationKey])}`);
		return [zones, paginationKey];
	}
}

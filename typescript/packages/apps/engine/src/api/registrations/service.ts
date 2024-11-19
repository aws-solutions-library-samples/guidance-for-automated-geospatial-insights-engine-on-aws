import { DomainEvent, RegionResource } from '@agie/events';
import { SecurityContext } from '@agie/rest-api-authorizer';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { ListPaginationOptions } from '../../common/schemas.js';
import { RegistrationRepository } from './repository.js';
import { RegistrationResource } from './schemas.js';

export class RegistrationService {
	public constructor(private readonly log: FastifyBaseLogger, private readonly repository: RegistrationRepository) {}

	public async process(event: DomainEvent<RegionResource>): Promise<void> {
		this.log.debug(`RegistrationService> process> event:${JSON.stringify(event)}`);

		const newRegion = event.new;
		const oldRegion = event.old;

		switch (event.eventType) {
			// create registration resource for the region
			case 'created':
				ow(newRegion, ow.object.nonEmpty);
				if (newRegion.processingConfig?.engineId) {
					await this.create({ regionId: newRegion.id, engineId: newRegion.processingConfig.engineId, createdAt: new Date(Date.now()).toISOString() });
				}
				break;
			// delete registration resource for the region
			case 'deleted':
				ow(oldRegion, ow.object.nonEmpty);
				if (oldRegion.processingConfig?.engineId) {
					await this.delete(oldRegion.processingConfig?.engineId, oldRegion.id);
				}
				break;
			case 'updated':
				ow(newRegion, ow.object.nonEmpty);
				ow(oldRegion, ow.object.nonEmpty);
				// delete old registration if newly engine id is updated
				if (newRegion.processingConfig?.engineId !== oldRegion.processingConfig?.engineId) {
					await this.delete(oldRegion.processingConfig?.engineId, newRegion.id);
					if (newRegion.processingConfig.engineId) {
						// create new registratrion resource
						await this.create({
							regionId: newRegion.id,
							engineId: newRegion.processingConfig.engineId,
							createdAt: new Date(Date.now()).toISOString(),
						});
					}
				}
				break;
		}
		this.log.debug(`RegistrationService> process> exit:`);
	}

	public async list(securityContext: SecurityContext, engineId: string, options: ListPaginationOptions) {
		this.log.debug(`RegistrationService> list> options: ${JSON.stringify(options)}`);

		ow(securityContext, ow.object.nonEmpty);
		ow(securityContext.sub, ow.string.nonEmpty);

		return await this.repository.list(engineId, options);
	}

	public async create(registration: RegistrationResource): Promise<RegistrationResource> {
		this.log.debug('RegistrationService> create> in>', registration);

		ow(
			registration,
			ow.object.partialShape({
				regionId: ow.string.nonEmpty,
				engineId: ow.string.nonEmpty,
			})
		);

		try {
			await this.repository.create(registration);
		} catch (error) {
			this.log.error('Error creating registration:', error);
			throw error;
		}

		this.log.debug(`RegistrationService> create> exit> registration: ${registration}`);
		return registration;
	}

	public async delete(engineId: string, regionId: string): Promise<void> {
		this.log.debug(`RegistrationService> delete> in> engineId: ${engineId}, regionId: ${regionId}`);

		ow(engineId, ow.string.nonEmpty);
		ow(regionId, ow.string.nonEmpty);

		await this.repository.delete(engineId, regionId);

		this.log.debug(`RegistrationService> delete> exit>`);
	}
}

import type { StacServerClient } from '@arcade/clients';
import type { GroupChangeEvent, PipelineMetadataDetails, RegionChangeEvent, ResultsChangeEvent } from '@arcade/events';
import { validateNotEmpty } from '@arcade/validators';
import type { BaseLogger } from 'pino';
import { StacUtil } from '../utils/stacUtil.js';
import type { ResultsRepository } from './repository.js';

export class EventProcessor {
	constructor(
		private log: BaseLogger,
		private readonly repository: ResultsRepository,
		private readonly stacServerClient: StacServerClient,
		private readonly stacUtil: StacUtil
	) {}

	public async processGroupChangeEvent(event: GroupChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processGroupChangeEvent >in  event: ${JSON.stringify(event)}`);

		validateNotEmpty(event, 'event');
		validateNotEmpty(event.detail, 'event.detail');
		validateNotEmpty(event.detail.groupId, 'event.detail.groupId');

		// Construct stac items
		if (!event.detail?.deleted) {
			// extra validation
			validateNotEmpty(event.detail.extent, 'event.detail.extent');
			validateNotEmpty(event.detail.links, 'event.detail.links');

			const groupCollection = await this.stacUtil.constructGroupCollection(event.detail);
			await this.stacServerClient.publishCollection(groupCollection);
		} else {
			// Delete event is to be implemented
		}

		this.log.info(`EventProcessor > processGroupChangeEvent >exit`);
	}

	public async processRegionChangeEvent(event: RegionChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processRegionChangeEvent >in  event: ${JSON.stringify(event)}`);

		validateNotEmpty(event, 'event');
		validateNotEmpty(event.detail, 'event.detail');
		validateNotEmpty(event.detail.regionId, 'event.detail.regionId');

		// Construct stac items
		if (!event.detail?.deleted) {
			// extra validation
			validateNotEmpty(event.detail.groupId, 'event.detail.groupId');
			validateNotEmpty(event.detail.extent, 'event.detail.extent');
			validateNotEmpty(event.detail.links, 'event.detail.links');

			const groupCollection = await this.stacUtil.constructRegionCollection(event.detail);
			await this.stacServerClient.publishCollection(groupCollection);
		} else {
			// Delete event is to be implemented
		}

		this.log.info(`EventProcessor > processRegionChangeEvent >exit`);
	}

	public async processQueuedEvent(event: ResultsChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processQueuedEvent >in  event: ${JSON.stringify(event)}`);

		validateNotEmpty(event, 'event');
		validateNotEmpty(event.detail, 'event.detail');

		// Get the full payload
		const pipelineMetadata: PipelineMetadataDetails = event.detail;
		pipelineMetadata.status = 'QUEUED';
		pipelineMetadata.createdAt = new Date().toISOString();
		await this.repository.put(pipelineMetadata);

		this.log.info(`EventProcessor > processQueuedEvent >exit`);
	}

	public async processStartedEvent(event: ResultsChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processStartedEvent >in  event: ${JSON.stringify(event)}`);

		validateNotEmpty(event, 'event');
		validateNotEmpty(event.detail, 'event.detail');
		validateNotEmpty(event.detail.executionId, 'executionId');
		validateNotEmpty(event.detail.groupId, 'groupId');
		validateNotEmpty(event.detail.regionId, 'regionId');
		validateNotEmpty(event.detail.zoneId, 'zoneId');
		validateNotEmpty(event.detail.stateId, 'stateId');

		// Get the full payload
		const pipelineMetadata: PipelineMetadataDetails = event.detail;

		// Update the metadata details
		pipelineMetadata.status = 'STARTED';
		pipelineMetadata.updatedAt = new Date().toISOString();
		await this.repository.put(pipelineMetadata);

		this.log.info(`EventProcessor > processStartedEvent >exit`);
	}

	public async processFailedEvent(event: ResultsChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processFailedEvent >in  event: ${JSON.stringify(event)}`);

		validateNotEmpty(event, 'event');
		validateNotEmpty(event.detail, 'event.detail');
		validateNotEmpty(event.detail.executionId, 'executionId');
		validateNotEmpty(event.detail.groupId, 'groupId');
		validateNotEmpty(event.detail.regionId, 'regionId');
		validateNotEmpty(event.detail.zoneId, 'zoneId');
		validateNotEmpty(event.detail.stateId, 'stateId');
		validateNotEmpty(event.detail.message, 'message');

		// Get the full payload
		const pipelineMetadata: PipelineMetadataDetails = await this.repository.get(event.detail.executionId, event.detail.zoneId);

		// Update the metadata details
		pipelineMetadata.status = 'FAILED';
		pipelineMetadata.updatedAt = new Date().toISOString();
		pipelineMetadata.message = event.detail.message;
		await this.repository.put(pipelineMetadata);

		// Construct stac items
		const stacItem = await this.stacUtil.constructStacItems(pipelineMetadata);
		if (stacItem) {
			await this.stacServerClient.publishStacItem(stacItem);
		}

		this.log.info(`EventProcessor > processFailedEvent >exit`);
	}

	public async processCompletedEvent(event: ResultsChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processCompletedEvent >in  event: ${JSON.stringify(event)}`);

		validateNotEmpty(event, 'event');
		validateNotEmpty(event.detail, 'event.detail');
		validateNotEmpty(event.detail.executionId, 'executionId');
		validateNotEmpty(event.detail.groupId, 'groupId');
		validateNotEmpty(event.detail.regionId, 'regionId');
		validateNotEmpty(event.detail.zoneId, 'zoneId');
		validateNotEmpty(event.detail.stateId, 'stateId');
		validateNotEmpty(event.detail.engineOutPutLocation, 'engineOutPutLocation');

		let pipelineMetadata: PipelineMetadataDetails = undefined;
		// Get the full payload
		pipelineMetadata = await this.repository.get(event.detail.executionId, event.detail.zoneId);

		if (!pipelineMetadata) {
			// Get the full payload
			pipelineMetadata = event.detail;
		}

		// Update the metadata details
		pipelineMetadata.status = 'SUCCEEDED';
		pipelineMetadata.engineOutPutLocation = event.detail.engineOutPutLocation;
		pipelineMetadata.updatedAt = new Date().toISOString();
		await this.repository.put(pipelineMetadata);

		// Construct stac items
		const stacItem = await this.stacUtil.constructStacItems(pipelineMetadata);
		if (stacItem) {
			await this.stacServerClient.publishStacItem(stacItem);
		}

		this.log.info(`EventProcessor > processCompletedEvent >exit`);
	}
}

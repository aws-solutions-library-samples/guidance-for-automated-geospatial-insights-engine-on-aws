import type { StacServerClient } from '@arcade/clients';
import type { CatalogCreateEvent, RegionChangeEvent } from '@arcade/events';
import {
	EngineJobCreatedDetails,
	EngineJobUpdatedDetails,
	GroupChangeEvent,
	PolygonsProcessingEvent,
	ResultsChangeEvent
} from '@arcade/events';
import { FastifyBaseLogger } from 'fastify';
import { ResultsService } from '../api/results/service.js';
import { StacUtil } from '../utils/stacUtil.js';

export class EventProcessor {
	constructor(
		private log: FastifyBaseLogger,
		private readonly service: ResultsService,
		private readonly stacServerClient: StacServerClient,
		private readonly stacUtil: StacUtil
	) {}

	public async processCatalogCreationEvent(event: CatalogCreateEvent): Promise<void> {
		this.log.info(`EventProcessor > processCatalogCreationEvent >in  event: ${JSON.stringify(event)}`);

		// Construct the catalog
		const catalog = await this.stacUtil.constructCatalog(event.detail);
		await this.stacServerClient.publishCatalog(catalog);

		this.log.info(`EventProcessor > processCatalogCreationEvent >exit`);
	}
	public async processGroupChangeEvent(event: GroupChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processGroupChangeEvent >in  event: ${JSON.stringify(event)}`);
		// Construct stac items
		if (event.detail.new) {
			const groupCollection = await this.stacUtil.constructGroupCollection(event.detail.new);
			await this.stacServerClient.publishCollection(groupCollection);
		} else {
			// Delete event is to be implemented
		}

		this.log.info(`EventProcessor > processGroupChangeEvent >exit`);
	}

	public async processRegionChangeEvent(event: RegionChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processRegionChangeEvent >in  event: ${JSON.stringify(event)}`);
		// Construct stac items
		if (event.detail?.new) {
			const regionCollection = await this.stacUtil.constructRegionCollection(event.detail.new);
			await this.stacServerClient.publishCollection(regionCollection);
			// when a region is created initially and no polygon associated with it, then bounding box will be undefined
			if (event.detail.new.boundingBox) {
				const regionStacItem = await this.stacUtil.constructRegionStacItem(event.detail.new)
				await this.stacServerClient.publishStacItem(regionStacItem);
			}
		} else {
			// Delete event is to be implemented
		}

		this.log.info(`EventProcessor > processRegionChangeEvent >exit`);
	}

	public async processExecutorPolygonMetadataCreatedEvent(event: PolygonsProcessingEvent): Promise<void> {
		this.log.info(`EventProcessor > processExecutorPolygonMetadataCreatedEvent >in  event: ${JSON.stringify(event)}`);
		// Construct stac items
		const stacItem = await this.stacUtil.constructStacItems(event.detail);
		if (stacItem) {
			await this.stacServerClient.publishStacItem(stacItem);
		}
		this.log.info(`EventProcessor > processExecutorPolygonMetadataCreatedEvent> exit`);
	}

	public async processExecutorJobUpdatedEvent(event: ResultsChangeEvent): Promise<void> {
		this.log.info(`EventProcessor > processQueuedEvent >in  event: ${JSON.stringify(event)}`);
		const resultDetails = event.detail?.new;
		if (event.detail.eventType === 'created') {
			await this.service.create(resultDetails as EngineJobCreatedDetails);
		} else {
			await this.service.update(resultDetails as EngineJobUpdatedDetails);
		}
		this.log.info(`EventProcessor > processQueuedEvent >exit`);
	}
}

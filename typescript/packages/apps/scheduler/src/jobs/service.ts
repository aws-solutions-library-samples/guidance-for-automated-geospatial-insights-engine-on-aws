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

import { LambdaRequestContext, Region, RegionsClient, ResultsClient, StacServerClient } from '@agie/clients';
import { StacItem, StartJobRequest } from '@agie/events';
import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from '@aws-sdk/client-sqs';
import { booleanContains, booleanWithin, polygon, union } from '@turf/turf';
import axios from 'axios';
import dayjs from 'dayjs';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { ulid } from 'ulid';
import { JobsRepository } from './repository.js';

export class JobsService {
	private readonly context: LambdaRequestContext;
	private readonly regionIndexName = 'agie-region';

	constructor(
		private readonly logger: FastifyBaseLogger,
		private readonly stacClient: StacServerClient,
		private readonly regionsClient: RegionsClient,
		private readonly results: ResultsClient,
		private readonly sqsClient: SQSClient,
		private readonly queueUrl: string,
		private readonly stacUrl: string,
		private readonly sentinelCollection: string,
		private readonly jobsRepository: JobsRepository
	) {
		this.context = {
			authorizer: {
				claims: {
					email: 'results',
					'custom:role': '/|||reader',
				},
			},
		};
	}

	public async startJobOnSchedule(region: Region): Promise<void> {
		this.logger.debug(`JobsService> startJobOnSchedule> region: ${JSON.stringify(region)}`);
		ow(region, ow.object.nonEmpty);
		ow(
			region,
			ow.object.partialShape({
				id: ow.string.nonEmpty,
				boundingBox: ow.array.length(4),
				processingConfig: ow.object.partialShape({
					priority: ow.string.nonEmpty,
				}),
			})
		);

		const latestResult = (await this.results.listResults(region.id, { count: 1, status: 'succeeded' }, this.context)).results?.[0]!;

		const currentDateTime = dayjs();

		const startJobRequest: StartJobRequest = {
			...region,
			latestResultId: latestResult?.id,
			startDateTime: latestResult?.endDateTime ?? currentDateTime.add(-5, 'day').toISOString(),
			endDateTime: currentDateTime.toISOString(),
		};

		const message = {
			Id: ulid().toLowerCase(),
			MessageBody: JSON.stringify(startJobRequest),
			MessageGroupId: region.id,
			// use the key (regionId) as the message deduplication id to prevent duplicate processing of the same region.
			MessageDeduplicationId: region.id,
		};

		await this.sqsClient.send(new SendMessageBatchCommand({ Entries: [message], QueueUrl: this.queueUrl }));

		this.logger.debug(`JobsService> startJobOnSchedule> exit`);
	}

	public async startJobOnRegionMatch(sentinelStacItemList: ({ messageId: string } & StacItem)[]): Promise<string[]> {
		this.logger.debug(`JobsService> startJobOnRegionMatch> stacItem: ${JSON.stringify(sentinelStacItemList)} `);

		ow(sentinelStacItemList, ow.array.nonEmpty);

		const regionProcessingDate: Record<string, StartJobRequest> = {};

		const failedBatchItemIds = [];

		for (const sentinelStacItem of sentinelStacItemList) {
			try {
				ow(sentinelStacItem.properties?.datetime, ow.string.nonEmpty);
				ow(sentinelStacItem.bbox, ow.array.length(4));

				const timeThreshold = dayjs().subtract(1, 'day');
				const stacItemDatetime = dayjs(sentinelStacItem.properties.datetime);

				// we will not process data that is more than 1 day old
				if (stacItemDatetime.isBefore(timeThreshold)) {
					this.logger.debug(`JobsService> startJobOnRegionMatch> skip stacItem with older datetime, stacItem: ${JSON.stringify(sentinelStacItem)}`);
					continue;
				}

				// search for all regions intersects the sentinel bounding box that is currently active and processing mode set to onNewScene
				const searchResult = await this.stacClient.search({
					collections: [this.regionIndexName],
					bbox: sentinelStacItem.bbox,
					query: {
						'agie:isActive': {
							eq: true,
						},
						'agie:processedOnNewScene': {
							eq: true,
						},
					},
				});

				if (searchResult.features.length < 1) {
					this.logger.debug(`JobsService> startJobOnRegionMatch> no region matches stac item`);
				}

				for (const item of searchResult.features) {
					const stacItemStartOfDay = dayjs(sentinelStacItem.properties.datetime).startOf('day').toISOString();

					if (!regionProcessingDate[item.id]) {
						// get the latest successful result of this region
						const latestResult = (await this.results.listResults(item.id, { count: 1, status: 'succeeded' }, this.context)).results?.[0]!;
						// set the search start date to 5 days ago or latest successful execution
						const startDateTime = latestResult?.endDateTime ?? dayjs(sentinelStacItem.properties.datetime).add(-5, 'day').startOf('day').toISOString();
						// set the search end date to the sentinel item datetime
						const endDateTime = dayjs(sentinelStacItem.properties.datetime).toISOString();

						this.logger.debug(`JobsService> startJobOnRegionMatch> search startDateTime: ${startDateTime}, endDateTime: ${endDateTime}`);

						const [isRegionWithinNewScene, hasJobRunForToday] = await Promise.all([
							this.isRegionWithinSentinelImages(sentinelStacItem, item, startDateTime, endDateTime),
							this.jobsRepository.get(item.id, stacItemStartOfDay),
						]);

						this.logger.info(
							`JobsService> startJobOnRegionMatch> isRegionWithinNewScene: ${isRegionWithinNewScene}, hasJobRunForToday: ${hasJobRunForToday}, stacItem: ${JSON.stringify(
								item
							)}`
						);

						// only trigger processing if new satellite image covers entire region
						if (isRegionWithinNewScene && !hasJobRunForToday) {
							// get the region resource
							const region = await this.regionsClient.getRegionById(item.id, this.context);

							regionProcessingDate[item.id] = {
								...region,
								// use the startDateTime of the previous run if exists
								startDateTime,
								endDateTime,
								latestResultId: latestResult?.id,
							};

							await this.jobsRepository.save(item.id, stacItemStartOfDay);
						}
					}
				}
			} catch (err) {
				this.logger.error(`JobsService> startJobOnRegionMatch> failed processing stac item: ${sentinelStacItem.id}, error: ${err}`);
				failedBatchItemIds.push(sentinelStacItem.messageId);
			}
		}

		if (Object.values(regionProcessingDate).length > 0) {
			const messages = Object.entries(regionProcessingDate).map(
				([key, value]): SendMessageBatchRequestEntry => ({
					Id: ulid().toLowerCase(),
					MessageBody: JSON.stringify(value),
					MessageGroupId: key,
					// use the key (regionId) as the message deduplication id to prevent duplicate processing of the same region.
					MessageDeduplicationId: key,
				})
			);

			this.logger.debug(`JobsService> startJobOnRegionMatch> sqsMessages: ${JSON.stringify(messages)}`);

			await this.sqsClient.send(new SendMessageBatchCommand({ Entries: messages, QueueUrl: this.queueUrl }));
		}

		this.logger.debug(`JobsService> startJobOnRegionMatch> stacItem: ${JSON.stringify(sentinelStacItemList)} `);

		return failedBatchItemIds;
	}

	private async isRegionWithinSentinelImages(sentinelItem: StacItem, regionItem: StacItem, startDateTime: string, endDateTime: string): Promise<boolean> {
		this.logger.debug(`JobsService> shouldProcessRegion> sentinelItem: ${JSON.stringify(sentinelItem)}, regionItem: ${regionItem}`);

		const regionPolygon = polygon(regionItem.geometry.coordinates);
		const stacItemPolygon = polygon(sentinelItem.geometry.coordinates);

		let matchRegion = false;

		// if the region is within the sentinel image bounding box then queue the processing task
		if (booleanContains(stacItemPolygon, regionPolygon)) {
			this.logger.info(`JobsService> shouldProcessRegion> stacItem ${sentinelItem.id} covers the whole region: ${regionItem.id}`);
			matchRegion = true;
		}
		// if one sentinel image does not cover the whole region, check if we can combine with other images
		else {
			this.logger.info(`JobsService> shouldProcessRegion> stacItem ${sentinelItem.id} does not cover the region: ${regionItem.id}`);
			const sortByDateDesc = (a: StacItem, b: StacItem) => {
				const dateA: any = new Date(a.properties.datetime);
				const dateB: any = new Date(b.properties.datetime);
				return dateB - dateA;
			};

			// query the stac server with the region bounding box
			let stacItems = [];
			try {
				const results = await axios.post(`${this.stacUrl}/search`, {
					bbox: regionItem.bbox,
					collections: [this.sentinelCollection],
					datetime: `${startDateTime}/${endDateTime}`,
					limit: 10,
				});

				this.logger.info(`JobsService> shouldProcessRegion> stac search result: ${results.data.features.length} items`);

				stacItems = [...results.data.features];
				stacItems.sort(sortByDateDesc);
			} catch (e) {
				this.logger.error(`JobsService> shouldProcessRegion> error: ${JSON.stringify(e)}, regionItem: ${regionItem}`);
			}

			let combinedPolygon: any,
				combinedStacItems = new Set<string>();

			for (const stacItem of stacItems) {
				combinedStacItems.add(stacItem.id);
				if (combinedPolygon) {
					combinedPolygon = union(combinedPolygon, polygon(stacItem.geometry.coordinates));
				} else {
					combinedPolygon = polygon(stacItem.geometry.coordinates);
				}
				// if boolean is within the combined region
				if (booleanWithin(regionPolygon, combinedPolygon)) {
					this.logger.info(
						`JobsService> shouldProcessRegion> combined polygons cover the region: ${regionItem.id}, stacItems: ${JSON.stringify(Array.from(combinedStacItems))}`
					);
					matchRegion = true;
					break;
				}
			}
		}

		this.logger.debug(`JobsService> shouldProcessRegion> matchRegion: ${matchRegion}`);
		return matchRegion;
	}
}

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

import { FastifyBaseLogger } from "fastify";
import { LambdaRequestContext, RegionsClient, StacServerClient } from "@agie/clients";
import { RegionResource, StacItem } from "@agie/events";
import { booleanContains, booleanWithin, polygon, union } from "@turf/turf";
import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from "@aws-sdk/client-sqs";
import ow from 'ow';
import { ulid } from "ulid";
import axios from 'axios';
import dayjs from 'dayjs';

export class JobsService {

	private readonly context: LambdaRequestContext;
	private readonly regionIndexName = 'agie-region';

	constructor(private readonly logger: FastifyBaseLogger,
				private readonly stacClient: StacServerClient,
				private readonly regionsClient: RegionsClient,
				private readonly sqsClient: SQSClient,
				private readonly queueUrl: string,
				private readonly stacUrl: string,
				private readonly sentinelCollection: string) {
		this.context = {
			authorizer: {
				claims: {
					email: 'results',
					'custom:role': '/|||reader',
				},
			},
		};
	}

	private async isRegionWithinSentinelImages(sentinelItem: StacItem, regionItem: StacItem): Promise<boolean> {
		this.logger.debug(`JobsService> shouldProcessRegion> sentinelItem: ${JSON.stringify(sentinelItem)}, regionItem: ${regionItem}`)

		const regionPolygon = polygon(regionItem.geometry.coordinates);
		const stacItemPolygon = polygon(sentinelItem.geometry.coordinates);

		let matchRegion = false;

		// if the region is within the sentinel image bounding box then queue the processing task
		if (booleanContains(stacItemPolygon, regionPolygon)) {
			matchRegion = true;
		}
		// if one sentinel image does not cover the whole region, check if we can combine with other images
		else {
			const sortByDateDesc = (a: StacItem, b: StacItem) => {
				const dateA: any = new Date(a.properties.datetime);
				const dateB: any = new Date(b.properties.datetime);
				return dateB - dateA
			};

			// query the stac server with the region bounding box
			let stacItems = [];
			try {
				const results = await axios.post(`${this.stacUrl}/search`, {
					bbox: regionItem.bbox,
					collections: [this.sentinelCollection],
					datetime: `${dayjs().subtract(5, 'day').toISOString()}/${dayjs().endOf('day').toISOString()}`,
					limit: 10,
				})
				stacItems = [...results.data.features]
				stacItems.sort(sortByDateDesc)
			} catch (e) {
				this.logger.error(`JobsService> shouldProcessRegion> error: ${JSON.stringify(e)}, regionItem: ${regionItem}`)
			}

			let combinedPolygon;
			for (const stacItem of stacItems) {
				if (combinedPolygon) {
					combinedPolygon = union(combinedPolygon, polygon(stacItem.geometry.coordinates));
				} else {
					combinedPolygon = polygon(stacItem.geometry.coordinates)
				}
				// if boolean is within the combined region
				if (booleanWithin(regionPolygon, combinedPolygon)) {
					matchRegion = true;
					break
				}
			}
		}

		this.logger.debug(`JobsService> shouldProcessRegion> matchRegion: ${matchRegion}`)
		return matchRegion;
	}


	public async startJobOnRegionMatch(sentinelStacItemList: StacItem[]): Promise<void> {
		this.logger.debug(`JobsService> startJobOnRegionMatch> stacItem: ${JSON.stringify(sentinelStacItemList)} `)

		ow(sentinelStacItemList, ow.array.nonEmpty);

		const regionProcessingDate: Record<string, { datetime: string, region: RegionResource }> = {};
		for (const sentinelStacItem of sentinelStacItemList) {
			ow(sentinelStacItem.properties?.datetime, ow.string.nonEmpty);
			ow(sentinelStacItem.bbox, ow.array.length(4));

			// search for all regions intersects the sentinel bounding box that is currently active and processing mode set to onNewScene
			const searchResult = await this.stacClient.search({
				collections: [this.regionIndexName],
				bbox: sentinelStacItem.bbox,
				"query": {
					"agie:isActive": {
						"eq": true
					},
					"agie:processedOnNewScene": {
						"eq": true
					}
				}
			})

			for (const item of searchResult.features) {
				if (!regionProcessingDate[item.id]) {
					const processRegion = await this.isRegionWithinSentinelImages(sentinelStacItem, item);
					if (processRegion) {
						const region = await this.regionsClient.getRegionById(item.id, this.context);
						regionProcessingDate[item.id] = {
							datetime: sentinelStacItem.properties.datetime,
							region
						}
					}
				}
			}
		}

		if (Object.values(regionProcessingDate).length > 0) {
			const messages = Object.entries(regionProcessingDate).map(([key, value]): SendMessageBatchRequestEntry => ({
				Id: ulid().toLowerCase(),
				MessageBody: JSON.stringify(value.region),
				MessageGroupId: key,
				// use the key (regionId) as the message deduplication id to prevent duplicate processing of the same region.
				MessageDeduplicationId: key,
			}))

			await this.sqsClient.send(new SendMessageBatchCommand({ Entries: messages, QueueUrl: this.queueUrl }))
		}

		this.logger.debug(`JobsService> startJobOnRegionMatch> stacItem: ${JSON.stringify(sentinelStacItemList)} `)
	}

}

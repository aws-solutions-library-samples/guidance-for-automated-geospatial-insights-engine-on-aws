import { FastifyBaseLogger } from "fastify";
import { LambdaRequestContext, RegionsClient, StacServerClient } from "@arcade/clients";
import { RegionResource, StacItem } from "@arcade/events";
import { bboxPolygon, booleanContains, polygon } from "@turf/turf";
import { SendMessageBatchCommand, SendMessageBatchRequestEntry, SQSClient } from "@aws-sdk/client-sqs";
import ow from 'ow';
import { ulid } from "ulid";

export class JobsService {

	readonly context: LambdaRequestContext;

	constructor(private readonly logger: FastifyBaseLogger, private readonly stacClient: StacServerClient, private readonly regionsClient: RegionsClient, private readonly sqsClient: SQSClient, private readonly queueUrl: string) {
		this.context = {
			authorizer: {
				claims: {
					email: 'results',
					'custom:role': '/|||reader',
				},
			},
		};
	}

	public async startJobOnRegionMatch(sentinelStacItemList: StacItem[]): Promise<void> {
		this.logger.debug(`JobsService> startJobOnRegionMatch> stacItem: ${JSON.stringify(sentinelStacItemList)} `)

		ow(sentinelStacItemList, ow.array.nonEmpty);

		const regionProcessingDate: Record<string, { datetime: string, region: RegionResource }> = {};
		for (const sentinelStacItem of sentinelStacItemList) {
			ow(sentinelStacItem.properties?.datetime, ow.string.nonEmpty);
			ow(sentinelStacItem.bbox, ow.array.length(4));

			const groupCollections = (await this.regionsClient.listGroups(this.context)).groups.map(o => `group_${o.id}`);

			// search for all regions intersects the sentinel bounding box that is currently active and processing mode set to onNewScene
			const searchResult = await this.stacClient.search({
				collections: groupCollections,
				bbox: sentinelStacItem.bbox,
				"query": {
					"arcade:isActive": {
						"eq": true
					},
					"arcade:processedOnNewScene": {
						"eq": true
					}
				}
			})
			const stacItemPolygon = bboxPolygon(sentinelStacItem.bbox);
			for (const item of searchResult.features) {
				const regionPolygon = polygon(item.geometry.coordinates);
				// if the region is within the sentinel image bounding box then queue the processing task
				if (booleanContains(stacItemPolygon, regionPolygon) && !regionProcessingDate[item.id]) {
					const region = await this.regionsClient.getRegionById(item.id, this.context);
					regionProcessingDate[item.id] = {
						datetime: sentinelStacItem.properties.datetime,
						region
					}
					// TODO: this will be implemented as part of the GeoMosaic works
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

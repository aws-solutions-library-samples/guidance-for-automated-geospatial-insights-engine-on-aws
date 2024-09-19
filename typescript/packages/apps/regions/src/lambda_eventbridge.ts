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

import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import {
	DomainEvent,
	REGIONS_EVENT_SOURCE,
	REGIONS_POLYGON_CREATED_EVENT,
	REGIONS_POLYGON_DELETED_EVENT,
	REGIONS_POLYGON_UPDATED_EVENT,
	REGIONS_REGION_CREATED_EVENT,
	REGIONS_REGION_DELETED_EVENT,
	REGIONS_REGION_UPDATED_EVENT
} from "@agie/events";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Polygon } from "./api/polygons/schemas.js";
import { Region } from "./api/regions/schemas.js";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const sqsClient = di.resolve<SQSClient>('sqsClient');
const queueUrl = process.env['SQS_QUEUE_URL']

export const handler: EventBridgeHandler<any, DomainEvent<any>, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);
	if ([
			REGIONS_POLYGON_CREATED_EVENT,
			REGIONS_POLYGON_UPDATED_EVENT,
			REGIONS_POLYGON_DELETED_EVENT,
			REGIONS_REGION_CREATED_EVENT,
			REGIONS_REGION_UPDATED_EVENT,
			REGIONS_REGION_DELETED_EVENT
		].includes(event["detail-type"])
		&& event['source'] === REGIONS_EVENT_SOURCE) {
		/**
		 * Forward all the events to SQS for processing, use the resource id as message group id
		 * to allow us to process all the messages for the resource within the same lambda
		 */
		let messageGroupId: string;
		switch (event.detail.resourceType) {
			case "Polygon":
				const polygonEvent = event.detail as DomainEvent<Polygon>
				messageGroupId = polygonEvent?.new?.regionId ?? polygonEvent?.old?.regionId
				break;
			case 'Region':
				const regionEvent = event.detail as DomainEvent<Region>
				messageGroupId = regionEvent?.new?.groupId ?? regionEvent?.old?.groupId;
				break;
			default:
				throw new Error(`Resource type ${event.detail.resourceType} is invalid for this process.`);
		}
		await sqsClient.send(new SendMessageCommand({
			MessageBody: JSON.stringify(event.detail),
			MessageGroupId: messageGroupId,
			QueueUrl: queueUrl
		}));
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}

	app.log.info(`EventBridgeLambda > handler >exit`);
};

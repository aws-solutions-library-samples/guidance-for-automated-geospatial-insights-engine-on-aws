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
import { EngineJobDetails, EngineJobUpdatedDetails } from "@agie/events";
import ow from 'ow';
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { SnsUtil } from "../../common/snsUtil.js";
import dayjs from 'dayjs';
import isBetween from "dayjs/plugin/isBetween.js";

dayjs.extend(isBetween)

export class NotificationsService {
	constructor(readonly log: FastifyBaseLogger,
				readonly roleArn: string,
				readonly snsClient: SNSClient,
				readonly snsUtil: SnsUtil) {
	}

	private assembleMessage(detail: EngineJobUpdatedDetails): string {
		return `Result ID: ${detail.id}\nRegion Id: ${detail.regionId}\n:Status: ${detail.status}`;
	}

	public async send(request: EngineJobDetails): Promise<void> {
		this.log.debug(`NotificationsService> send> request:${JSON.stringify(request)}`);
		ow(request, ow.object.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		const topic = this.snsUtil.topicArn(request.regionId)
		await this.snsClient.send(new PublishCommand({ Message: this.assembleMessage(request), TopicArn: topic }))
		this.log.debug(`NotificationsService> send> request:${JSON.stringify(request)}`);
	}

}

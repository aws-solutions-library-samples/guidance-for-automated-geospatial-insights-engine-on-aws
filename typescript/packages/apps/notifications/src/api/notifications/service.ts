import { FastifyBaseLogger } from "fastify";
import { EngineJobDetails, EngineJobUpdatedDetails } from "@arcade/events";
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

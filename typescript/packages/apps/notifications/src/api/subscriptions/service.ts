import { FastifyBaseLogger } from "fastify";
import { SubscriptionsRepository } from "./repository.js";
import { SecurityContext } from "../../common/scopes.js";
import { Subscription, SubscriptionId, SubscriptionListOptions, SubscriptionWithUserId } from "./schemas.js";
import { ulid } from "ulid";
import { CreateTopicCommand, GetTopicAttributesCommand, SNSClient, SubscribeCommand, UnsubscribeCommand, } from "@aws-sdk/client-sns";
import ow from 'ow';
import { SnsUtil } from "../../common/snsUtil.js";
import { ConflictError } from "../../common/errors.js";

export class SubscriptionsService {

	readonly protocol = 'sms'

	public constructor(
		readonly log: FastifyBaseLogger,
		readonly subscriptionsRepository: SubscriptionsRepository,
		readonly snsClient: SNSClient,
		readonly snsUtil: SnsUtil,
	) {
	}

	private async createSnsSubscription(regionId: string, phoneNumber: string): Promise<string> {
		this.log.debug(`SubscriptionsService> createSnsSubscription> regionId: ${regionId}, phoneNumber: ${phoneNumber}`);
		const topicArn = this.snsUtil.topicArn(regionId)
		try {
			await this.snsClient.send(new GetTopicAttributesCommand({ TopicArn: topicArn }))
		} catch (e) {
			if (e.name === 'NotFoundException') {
				await this.snsClient.send(new CreateTopicCommand({ Name: this.snsUtil.topicName(regionId) }))
			} else {
				this.log.error(`SubscriptionsService> createSnsSubscription> error: ${e}`);
				throw e;
			}
		}

		const response = await this.snsClient.send(new SubscribeCommand({ Protocol: this.protocol, TopicArn: topicArn, Endpoint: phoneNumber }))

		this.log.debug(`SubscriptionsService> createSnsSubscription> exit>`);

		return response.SubscriptionArn
	}

	public async create(securityContext: SecurityContext, createSubscription: Pick<Subscription, 'regionId'>): Promise<Subscription> {
		this.log.debug(`SubscriptionsService> create> securityContext: ${JSON.stringify(securityContext)} createSubscription: ${JSON.stringify(createSubscription)}`);

		ow(securityContext, ow.object.nonEmpty);
		ow(securityContext.phoneNumber, ow.string.nonEmpty);
		ow(createSubscription, ow.object.nonEmpty);
		ow(createSubscription.regionId, ow.string.nonEmpty);

		const existingSubscription = await this.subscriptionsRepository.getByRegionId(securityContext.sub, createSubscription.regionId);
		if (existingSubscription) {
			throw new ConflictError(`Subscription exists to region ${createSubscription.regionId} for user: ${securityContext.email}`)
		}

		const subscriptionArn = await this.createSnsSubscription(createSubscription.regionId, securityContext.phoneNumber);
		const subscription: SubscriptionWithUserId = {
			id: ulid().toLowerCase(),
			createdAt: new Date(Date.now()).toISOString(),
			regionId: createSubscription.regionId,
			userId: securityContext.sub,
			subscriptionArn
		}

		await this.subscriptionsRepository.create(subscription);
		this.log.debug(`SubscriptionsService> create> exit>`);
		return subscription
	}

	public async list(securityContext: SecurityContext, options: SubscriptionListOptions): Promise<[Subscription[], SubscriptionId]> {
		this.log.debug(`SubscriptionsService> list>  options: ${options}`);
		let listResponse: [Subscription[], SubscriptionId];
		listResponse = await this.subscriptionsRepository.list(securityContext.sub, options);
		this.log.debug(`SubscriptionsService> list> exit>`);
		return listResponse
	}

	public async delete(securityContext: SecurityContext, subscriptionId: string): Promise<void> {
		ow(subscriptionId, ow.string.nonEmpty);
		this.log.debug(`SubscriptionsService> delete> subscriptionId: ${subscriptionId}`);
		const subscription = await this.subscriptionsRepository.get(securityContext.sub, subscriptionId);
		await Promise.all([this.subscriptionsRepository.delete(securityContext.sub, subscriptionId), this.snsClient.send(new UnsubscribeCommand({ SubscriptionArn: subscription.subscriptionArn }))])
		this.log.debug(`SubscriptionsService> delete> exit>`);
	}
}

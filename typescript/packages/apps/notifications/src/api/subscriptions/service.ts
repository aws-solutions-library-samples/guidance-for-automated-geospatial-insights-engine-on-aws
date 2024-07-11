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
import { SubscriptionsRepository } from "./repository.js";
import { SecurityContext } from "../../common/scopes.js";
import { Subscription, SubscriptionId, SubscriptionListOptions, SubscriptionWithUserId } from "./schemas.js";
import { ulid } from "ulid";
import {
	CreateTopicCommand,
	DeleteTopicCommand,
	GetTopicAttributesCommand,
	ListSubscriptionsByTopicCommand,
	SNSClient,
	SubscribeCommand,
	UnsubscribeCommand
} from "@aws-sdk/client-sns";
import ow from 'ow';
import { SnsUtil } from "../../common/snsUtil.js";
import { ConflictError } from "../../common/errors.js";
import { EventPublisher } from "@arcade/events";
import { RegionsClient } from "@arcade/clients";

export class SubscriptionsService {

	readonly protocol = 'sms'

	public constructor(
		readonly log: FastifyBaseLogger,
		readonly subscriptionsRepository: SubscriptionsRepository,
		readonly snsClient: SNSClient,
		readonly snsUtil: SnsUtil,
		readonly eventPublisher: EventPublisher,
		readonly regionsClient: RegionsClient
	) {
	}

	private async deleteSnsTopic(topicArn: string): Promise<void> {
		this.log.debug(`SubscriptionsService> deleteSnsTopic> topicArn: ${topicArn}`);
		const listSubscriptionResponse = await this.snsClient.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }))
		if (listSubscriptionResponse.Subscriptions.length === 0) {
			await this.snsClient.send(new DeleteTopicCommand({ TopicArn: topicArn }))
		}
		this.log.debug(`SubscriptionsService> deleteSnsTopic> exit`);
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

		// this will throw exception if region does not exist
		await this.regionsClient.getRegionById(createSubscription.regionId, {
				authorizer: {
					claims: {
						email: securityContext.email,
						'custom:role': `/|||${securityContext.role}`,
					},
				},
			}
		);

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

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'created',
			id: subscription.id,
			resourceType: 'Subscription',
			new: subscription,
		});

		this.log.debug(`SubscriptionsService> create> exit>`);
		return subscription
	}

	public async list(securityContext: SecurityContext, options: SubscriptionListOptions): Promise<[Subscription[], SubscriptionId]> {
		this.log.debug(`SubscriptionsService> list> options: ${JSON.stringify(options)}`);
		let listResponse: [Subscription[], SubscriptionId];
		listResponse = await this.subscriptionsRepository.list(securityContext.sub, options);
		this.log.debug(`SubscriptionsService> list> exit>`);
		return listResponse
	}

	public async delete(securityContext: SecurityContext, subscriptionId: string): Promise<void> {
		ow(subscriptionId, ow.string.nonEmpty);
		this.log.debug(`SubscriptionsService> delete> subscriptionId: ${subscriptionId}`);
		const subscription = await this.subscriptionsRepository.get(securityContext.sub, subscriptionId);
		// delete subscription information from DynamoDB and also from SNS
		await Promise.all([
			this.subscriptionsRepository.delete(securityContext.sub, subscriptionId),
			this.snsClient.send(new UnsubscribeCommand({ SubscriptionArn: subscription.subscriptionArn }))
		])

		// delete the topic is no user is subscribing to it
		await this.deleteSnsTopic(this.snsUtil.topicArn(subscription.regionId))

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'deleted',
			id: subscription.id,
			resourceType: 'Subscription',
			old: subscription
		});
		this.log.debug(`SubscriptionsService> delete> exit>`);
	}
}

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

import pkg from 'aws-xray-sdk';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { SubscriptionsRepository } from "../api/subscriptions/repository.js";
import { SubscriptionsService } from "../api/subscriptions/service.js";
import { DynamoDBDocumentClient, TranslateConfig } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SNSClient } from '@aws-sdk/client-sns';
import { SnsUtil } from "../common/snsUtil.js";
import { NotificationsService } from "../api/notifications/service.js";
import { LambdaClient } from '@aws-sdk/client-lambda';
import { ApiAuthorizer } from "@arcade/rest-api-authorizer";
import { VerifiedPermissionsClient } from "@aws-sdk/client-verifiedpermissions";
import { EventPublisher, NOTIFICATIONS_EVENT_SOURCE } from "@arcade/events";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { RegionsClient } from "@arcade/clients";
import { Invoker } from "@arcade/lambda-invoker";

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		subscriptionsRepository: SubscriptionsRepository;
		subscriptionsService: SubscriptionsService;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		snsClient: SNSClient;
		snsUtil: SnsUtil;
		notificationsService: NotificationsService;
		apiAuthorizer: ApiAuthorizer;
		avpClient: VerifiedPermissionsClient;
		eventBridgeClient: EventBridgeClient;
		eventPublisher: EventPublisher;
		lambdaInvoker: Invoker;
		lambdaClient: LambdaClient;
		regionsClient: RegionsClient;
	}
}

class LambdaClientFactory {
	public static create(region: string): LambdaClient {
		return captureAWSv3Client(new LambdaClient({ region }));
	}
}

class DynamoDBDocumentClientFactory {
	public static create(region: string): DynamoDBDocumentClient {
		const ddb = captureAWSv3Client(new DynamoDBClient({ region }));
		const marshallOptions = {
			convertEmptyValues: false,
			removeUndefinedValues: true,
			convertClassInstanceToMap: false,
		};
		const unmarshallOptions = {
			wrapNumbers: false,
		};
		const translateConfig: TranslateConfig = { marshallOptions, unmarshallOptions };
		const dbc = DynamoDBDocumentClient.from(ddb, translateConfig);
		return dbc;
	}
}

class EventBridgeClientFactory {
	public static create(region: string | undefined): EventBridgeClient {
		const eb = captureAWSv3Client(new EventBridgeClient({ region }));
		return eb;
	}
}

class VerifiedPermissionsClientFactory {
	public static create(region: string): VerifiedPermissionsClient {
		return captureAWSv3Client(
			new VerifiedPermissionsClient({
				region,
			})
		);
	}
}

class SNSClientFactory {
	public static create(region: string): SNSClient {
		return captureAWSv3Client(new SNSClient({ region }));
	}
}


const registerContainer = (app?: FastifyInstance) => {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON
	};
	const awsRegion = process.env['AWS_REGION'];
	const tableName = process.env['TABLE_NAME'];
	const accountId = process.env['AWS_ACCOUNT_ID'];
	const roleArn: string = process.env['ROLE_ARN'];
	const gsi1IndexName = 'siKey1-pk-index';
	const userPoolId = process.env['USER_POOL_ID'];
	const policyStoreId = process.env['POLICY_STORE_ID'];
	const clientId = process.env['CLIENT_ID'];
	const eventBusName = process.env['EVENT_BUS_NAME'];
	const regionsApiFunctionName = process.env['REGIONS_API_FUNCTION_NAME'];

	diContainer.register({
		// Clients
		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		snsClient: asFunction(() => SNSClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		snsUtil: asFunction((container) => new SnsUtil(awsRegion, accountId), {
			...commonInjectionOptions,
		}),

		notificationsService: asFunction((container) => new NotificationsService(app.log, roleArn, container.snsClient, container.snsUtil), {
			...commonInjectionOptions,
		}),

		subscriptionsService: asFunction((container) => new SubscriptionsService(app.log, container.subscriptionsRepository, container.snsClient, container.snsUtil, container.eventPublisher, container.regionsClient), {
			...commonInjectionOptions,
		}),

		subscriptionsRepository: asFunction((container) => new SubscriptionsRepository(app.log, container.dynamoDBDocumentClient, tableName, gsi1IndexName), {
			...commonInjectionOptions,
		}),

		avpClient: asFunction(() => VerifiedPermissionsClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		apiAuthorizer: asFunction((c: Cradle) => new ApiAuthorizer(app.log, c.avpClient, policyStoreId, userPoolId, clientId), {
			...commonInjectionOptions,
		}),

		eventPublisher: asFunction((container: Cradle) => new EventPublisher(app.log, container.eventBridgeClient, eventBusName, NOTIFICATIONS_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),

		lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		lambdaInvoker: asFunction((container: Cradle) => new Invoker(app.log, container.lambdaClient), {
			...commonInjectionOptions,
		}),

		regionsClient: asFunction((c: Cradle) => new RegionsClient(app.log, c.lambdaInvoker, regionsApiFunctionName),
			{
				...commonInjectionOptions,
			}
		),
	});
};

export default fp<FastifyAwilixOptions>(async (app: FastifyInstance): Promise<void> => {
	// first register the DI plugin
	await app.register(fastifyAwilixPlugin, {
		disposeOnClose: true,
		disposeOnResponse: false
	});

	registerContainer(app);
});

export { registerContainer };

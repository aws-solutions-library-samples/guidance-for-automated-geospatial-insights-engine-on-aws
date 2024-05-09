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
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { LambdaClient } from '@aws-sdk/client-lambda';
import { ApiAuthorizer } from "@arcade/rest-api-authorizer";
import { VerifiedPermissionsClient } from "@aws-sdk/client-verifiedpermissions";

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		subscriptionsRepository: SubscriptionsRepository;
		subscriptionsService: SubscriptionsService;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		snsClient: SNSClient;
		snsUtil: SnsUtil;
		notificationsService: NotificationsService;
		schedulerClient: SchedulerClient;
		apiAuthorizer: ApiAuthorizer;
		avpClient: VerifiedPermissionsClient;
	}
}

class SchedulerClientFactory {
	public static create(region: string | undefined): SchedulerClient {
		return captureAWSv3Client(new SchedulerClient({ region }));
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


	diContainer.register({
		// Clients
		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		schedulerClient: asFunction(() => SchedulerClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		snsClient: asFunction(() => SNSClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		snsUtil: asFunction((container) => new SnsUtil(awsRegion, accountId), {
			...commonInjectionOptions,
		}),

		notificationsService: asFunction((container) => new NotificationsService(app.log, container.schedulerClient, roleArn, container.snsClient, container.snsUtil), {
			...commonInjectionOptions,
		}),

		subscriptionsService: asFunction((container) => new SubscriptionsService(app.log, container.subscriptionsRepository, container.snsClient, container.snsUtil), {
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
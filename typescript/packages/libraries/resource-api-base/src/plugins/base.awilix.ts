import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import { Cradle, diContainer } from '@fastify/awilix';
import { Lifetime, asFunction } from 'awilix';
import pkg from 'aws-xray-sdk';
const { captureAWSv3Client } = pkg;
//// @ts-ignore
import { Invoker } from '@arcade/lambda-invoker';
import { Utils } from '../common/utils.js';

import type { FastifyBaseLogger } from 'fastify';

// declaration merging to allow for typescript checking
declare module '@fastify/awilix' {
	interface Cradle extends BaseCradle {}
}

export interface BaseCradle {
	dynamoDBDocumentClient: DynamoDBDocumentClient;
	invoker: Invoker;
	lambdaClient: LambdaClient;
	sqsClient: SQSClient;
	utils: Utils;
}

// factories for instantiation of 3rd party objects
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

class LambdaClientFactory {
	public static create(region: string): LambdaClient {
		return captureAWSv3Client(new LambdaClient({ region }));
	}
}

class SQSClientFactory {
	public static create(region: string): SQSClient {
		return captureAWSv3Client(new SQSClient({ region }));
	}
}

export function registerBaseAwilix(logger: FastifyBaseLogger) {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON,
	};

	const awsRegion = process.env['AWS_REGION'];

	// then we can register our classes with the DI container
	diContainer.register({
		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		sqsClient: asFunction(() => SQSClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		invoker: asFunction((container: Cradle) => new Invoker(logger, container.lambdaClient), {
			...commonInjectionOptions,
		}),

		utils: asFunction(() => new Utils(logger), {
			...commonInjectionOptions,
		}),
	});
}

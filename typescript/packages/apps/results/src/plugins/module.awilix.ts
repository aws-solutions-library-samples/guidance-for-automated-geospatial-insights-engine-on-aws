import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import pkg from 'aws-xray-sdk';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ResultsRepository } from '../events/repository.js';
// @ts-ignore
import { RegionsClient, StacServerClient } from '@arcade/clients';
import { EventPublisher, RESULTS_EVENT_SOURCE } from '@arcade/events';
import { Invoker } from '@arcade/lambda-invoker';
import { BaseCradle, registerBaseAwilix } from '@arcade/resource-api-base';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import type { Client, Command } from '@aws-sdk/smithy-client';
import type { MetadataBearer, RequestPresigningArguments } from '@aws-sdk/types';
import { EventProcessor } from '../events/eventProcessor.js';
import { StacUtil } from '../utils/stacUtil.js';

const { captureAWSv3Client } = pkg;

export type GetSignedUrl = <InputTypesUnion extends object, InputType extends InputTypesUnion, OutputType extends MetadataBearer = MetadataBearer>(
	client: Client<any, InputTypesUnion, MetadataBearer, any>,
	command: Command<InputType, OutputType, any, InputTypesUnion, MetadataBearer>,
	options?: RequestPresigningArguments
) => Promise<string>;

declare module '@fastify/awilix' {
	interface Cradle extends BaseCradle {
		eventProcessor: EventProcessor;
		eventBridgeClient: EventBridgeClient;
		dynamoDbUtils: DynamoDbUtils;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		s3Client: S3Client;
		ssmClient: SSMClient;
		lambdaClient: LambdaClient;
		snsClient: SNSClient;
		stacServerClient: StacServerClient;
		regionsClient: RegionsClient;
		stacUtil: StacUtil;
		eventPublisher: EventPublisher;
		resultsRepository: ResultsRepository;
		lambdaInvoker: Invoker;
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

class S3ClientFactory {
	public static create(region: string): S3Client {
		const s3 = captureAWSv3Client(new S3Client({ region }));
		return s3;
	}
}

class SSMClientFactory {
	public static create(region: string): SSMClient {
		const ssm = captureAWSv3Client(new SSMClient({ region }));
		return ssm;
	}
}

class LambdaClientFactory {
	public static create(region: string): LambdaClient {
		return captureAWSv3Client(new LambdaClient({ region }));
	}
}

class SNSClientFactory {
	public static create(region: string): SNSClient {
		return captureAWSv3Client(new SNSClient({ region }));
	}
}

const registerContainer = (app?: FastifyInstance) => {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON,
	};

	const awsRegion = process.env['AWS_REGION'];
	const eventBusName = process.env['EVENT_BUS_NAME'];
	const bucketName = process.env['BUCKET_NAME'];
	const tableName = process.env['TABLE_NAME'];
	const stacServerFunctionName = process.env['STAC_SERVER_FUNCTION_NAME'];
	const stacServerTopicArn = process.env['STAC_SERVER_TOPIC_ARN'];
	const regionsFunctionName = process.env['REGIONS_FUNCTION_NAME'];

	diContainer.register({
		// Clients
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		s3Client: asFunction(() => S3ClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		ssmClient: asFunction(() => SSMClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		snsClient: asFunction(() => SNSClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		dynamoDbUtils: asFunction((container: Cradle) => new DynamoDbUtils(app.log, container.dynamoDBDocumentClient), {
			...commonInjectionOptions,
		}),

		eventPublisher: asFunction((container: Cradle) => new EventPublisher(app.log, container.eventBridgeClient, eventBusName, RESULTS_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),

		lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		stacServerClient: asFunction(
			(container: Cradle) => new StacServerClient(app.log, container.snsClient, container.lambdaClient, stacServerTopicArn, stacServerFunctionName),
			{
				...commonInjectionOptions,
			}
		),

		lambdaInvoker: asFunction((container: Cradle) => new Invoker(app.log, container.lambdaClient), {
			...commonInjectionOptions,
		}),

		regionsClient: asFunction((container: Cradle) => new RegionsClient(app.log, container.lambdaInvoker, regionsFunctionName), {
			...commonInjectionOptions,
		}),

		stacUtil: asFunction((container: Cradle) => new StacUtil(app.log, container.s3Client, bucketName, container.regionsClient), {
			...commonInjectionOptions,
		}),

		// Event Processors
		eventProcessor: asFunction((container) => new EventProcessor(app.log, container.resultsRepository, container.stacServerClient, container.stacUtil), {
			...commonInjectionOptions,
		}),

		// Repositories
		resultsRepository: asFunction((container) => new ResultsRepository(app.log, container.dynamoDBDocumentClient, tableName), {
			...commonInjectionOptions,
		}),
	});
};

export default fp<FastifyAwilixOptions>(async (app: FastifyInstance): Promise<void> => {
	// first register the DI plugin
	await app.register(fastifyAwilixPlugin, {
		disposeOnClose: true,
		disposeOnResponse: false,
	});

	registerBaseAwilix(app.log);

	registerContainer(app);
});

export { registerContainer };

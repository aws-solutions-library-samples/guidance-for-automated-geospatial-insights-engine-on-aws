import pkg from 'aws-xray-sdk';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { DynamoDBDocumentClient, TranslateConfig } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchClient } from "@aws-sdk/client-batch";
import { JobsService } from "../jobs/service.js";
import { RegionsClient } from "@arcade/clients";
import { Invoker } from "@arcade/lambda-invoker";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { EventPublisher, EXECUTOR_EVENT_SOURCE } from "@arcade/events";

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		eventBridgeClient: EventBridgeClient;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		batchClient: BatchClient;
		jobsService: JobsService;
		regionsClient: RegionsClient;
		lambdaInvoker: Invoker;
		lambdaClient: LambdaClient;
		s3Client: S3Client;
		eventPublisher: EventPublisher;
	}
}

class DynamoDBDocumentClientFactory {
	public static create(region: string): DynamoDBDocumentClient {
		const ddb = captureAWSv3Client(new DynamoDBClient({ region }));
		const marshallOptions = {
			convertEmptyValues: false,
			removeUndefinedValues: true,
			convertClassInstanceToMap: false
		};
		const unmarshallOptions = {
			wrapNumbers: false
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

class S3ClientFactory {
	public static create(region: string): S3Client {
		return captureAWSv3Client(new S3Client({ region }));
	}
}

class EventBridgeClientFactory {
	public static create(region: string | undefined): EventBridgeClient {
		const eb = captureAWSv3Client(new EventBridgeClient({ region }));
		return eb;
	}
}

class BatchClientFactory {
	public static create(region: string | undefined): BatchClient {
		return captureAWSv3Client(new BatchClient({ region }));
	}
}

const registerContainer = (app?: FastifyInstance) => {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON
	};

	const awsRegion = process.env['AWS_REGION'];
	const bucketName = process.env['BUCKET_NAME'];
	const jobDefinitionArn = process.env['JOB_DEFINITION_ARN'];
	const jobQueueArn = process.env['JOB_QUEUE_ARN'];
	const regionsApiFunctionName = process.env['REGIONS_API_FUNCTION_NAME'];
	const concurrencyLimit = parseInt(process.env['CONCURRENCY_LIMIT']);
	const eventBusName = process.env['EVENT_BUS_NAME'];

	diContainer.register({
		// Clients
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		batchClient: asFunction(() => BatchClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		s3Client: asFunction(() => S3ClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		eventPublisher: asFunction((c: Cradle) => new EventPublisher(app.log, c.eventBridgeClient, eventBusName, EXECUTOR_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),

		jobsService: asFunction(
			(c: Cradle) => new JobsService(app.log, c.batchClient, c.regionsClient, jobDefinitionArn, jobQueueArn, concurrencyLimit, bucketName, c.s3Client, c.eventPublisher),
			{
				...commonInjectionOptions,
			}
		),

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
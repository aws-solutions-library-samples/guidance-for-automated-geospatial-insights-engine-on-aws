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
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SchedulesService } from "../schedules/service.js";
import { RegionsClient } from "@arcade/clients";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { Invoker } from "@arcade/lambda-invoker";

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		eventBridgeClient: EventBridgeClient;
		schedulerClient: SchedulerClient;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		batchClient: BatchClient;
		jobsService: JobsService;
		schedulesService: SchedulesService;
		regionsClient: RegionsClient;
		lambdaInvoker: Invoker;
		lambdaClient: LambdaClient;
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

class SchedulerClientFactory {
	public static create(region: string | undefined): SchedulerClient {
		return captureAWSv3Client(new SchedulerClient({ region }));
	}
}


const registerContainer = (app?: FastifyInstance) => {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON
	};

	const awsRegion = process.env['AWS_REGION'];
	const eventBusName = process.env['EVENT_BUS_NAME'];

	const jobDefinitionArn = process.env['JOB_DEFINITION_ARN'];
	const jobQueueArn = process.env['JOB_QUEUE_ARN'];

	const schedulerGroup = process.env['SCHEDULER_GROUP'];
	const sqsArn = process.env['SQS_ARN'];
	const roleArn: string = process.env['ROLE_ARN'];

	const regionsApiFunctionName = process.env['REGIONS_API_FUNCTION_NAME'];
	const concurrencyLimit = parseInt(process.env['CONCURRENCY_LIMIT']);

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

		schedulerClient: asFunction(() => SchedulerClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		jobsService: asFunction(
			(c: Cradle) => new JobsService(app.log, c.batchClient, c.regionsClient, jobDefinitionArn, jobQueueArn, concurrencyLimit),
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

		regionsClient: asFunction(
			(c: Cradle) => new RegionsClient(app.log, c.lambdaInvoker, regionsApiFunctionName),
			{
				...commonInjectionOptions,
			}
		),

		schedulesService: asFunction(
			(c: Cradle) => new SchedulesService(app.log, c.schedulerClient, schedulerGroup, sqsArn, roleArn),
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

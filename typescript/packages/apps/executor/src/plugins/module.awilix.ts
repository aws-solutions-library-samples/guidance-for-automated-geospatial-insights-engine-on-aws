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

import { RegionsClient } from '@agie/clients';
import { EventPublisher, EXECUTOR_EVENT_SOURCE, Priority } from '@agie/events';
import { Invoker } from '@agie/lambda-invoker';
import { BatchClient } from '@aws-sdk/client-batch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import pkg from 'aws-xray-sdk';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { JobQueueArn } from '../jobs/model.js';
import { JobsService } from '../jobs/service.js';

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
		lifetime: Lifetime.SINGLETON,
	};

	const awsRegion = process.env['AWS_REGION'];
	const bucketName = process.env['BUCKET_NAME'];
	const jobDefinitionArn = process.env['JOB_DEFINITION_ARN'];
	const highPriorityQueueArn = process.env['HIGH_PRIORITY_QUEUE_ARN'];
	const lowPriorityQueueArn = process.env['LOW_PRIORITY_QUEUE_ARN'];
	const standardPriorityQueueArn = process.env['STANDARD_PRIORITY_QUEUE_ARN'];

	const regionsApiFunctionName = process.env['REGIONS_API_FUNCTION_NAME'];
	const concurrencyLimit = parseInt(process.env['CONCURRENCY_LIMIT']);
	const eventBusName = process.env['EVENT_BUS_NAME'];

	const queuePriorityMap: Record<Priority, JobQueueArn> = {
		high: highPriorityQueueArn,
		standard: standardPriorityQueueArn,
		low: lowPriorityQueueArn,
	};

	diContainer.register({
		// Clients
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		batchClient: asFunction(() => BatchClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		s3Client: asFunction(() => S3ClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		eventPublisher: asFunction((c: Cradle) => new EventPublisher(app.log, c.eventBridgeClient, eventBusName, EXECUTOR_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),

		jobsService: asFunction(
			(c: Cradle) => new JobsService(app.log, c.batchClient, c.regionsClient, jobDefinitionArn, queuePriorityMap, concurrencyLimit, bucketName, c.s3Client, c.eventPublisher),
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

		regionsClient: asFunction((c: Cradle) => new RegionsClient(app.log, c.lambdaInvoker, regionsApiFunctionName), {
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

	registerContainer(app);
});

export { registerContainer };

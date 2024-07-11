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
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SchedulesService } from "../schedules/service.js";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { RegionsClient, StacServerClient } from "@arcade/clients";
import { SNSClient } from "@aws-sdk/client-sns";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { JobsService } from "../jobs/service.js";
import { Invoker } from "@arcade/lambda-invoker";
import { SQSClient } from "@aws-sdk/client-sqs";

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		schedulerClient: SchedulerClient;
		snsClient: SNSClient;
		sqsClient: SQSClient;
		secretsManagerClient: SecretsManagerClient;
		schedulesService: SchedulesService;
		stacServerClient: StacServerClient;
		jobsService: JobsService;
		regionsClient: RegionsClient;
		lambdaInvoker: Invoker;
		lambdaClient: LambdaClient;
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

class SchedulerClientFactory {
	public static create(region: string | undefined): SchedulerClient {
		return captureAWSv3Client(new SchedulerClient({ region }));
	}
}

class SnsClientFactory {
	public static create(region: string | undefined): SNSClient {
		return captureAWSv3Client(new SNSClient({ region }));
	}
}

class SecretsManagerClientFactory {
	public static create(region: string | undefined): SecretsManagerClient {
		return captureAWSv3Client(new SecretsManagerClient({ region }));
	}
}


const registerContainer = (app?: FastifyInstance) => {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON
	};

	const awsRegion = process.env['AWS_REGION'];
	const environment = process.env['ENVIRONMENT'];
	const schedulerGroup = process.env['SCHEDULER_GROUP'];
	const sqsArn = process.env['SQS_ARN'];
	const roleArn: string = process.env['ROLE_ARN'];
	const queueUrl = process.env['QUEUE_URL'];
	const stacServerTopicArn = process.env['STAC_SERVER_TOPIC_ARN'];
	const stacApiEndpoint = process.env['STAC_API_ENDPOINT'];
	const regionsApiFunctionName = process.env['REGIONS_API_FUNCTION_NAME'];
	const sentinelApiUrl = process.env['SENTINEL_API_URL']
	const sentinelCollection = process.env['SENTINEL_COLLECTION'];

	diContainer.register({
		// Clients
		schedulerClient: asFunction(() => SchedulerClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		snsClient: asFunction(() => SnsClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		sqsClient: asFunction(() => SQSClientFactory.create(awsRegion), {
			...commonInjectionOptions
		}),

		schedulesService: asFunction(
			(c: Cradle) => new SchedulesService(app.log, c.schedulerClient, schedulerGroup, sqsArn, roleArn, environment),
			{
				...commonInjectionOptions,
			}
		),

		secretsManagerClient: asFunction(() => SecretsManagerClientFactory.create(awsRegion), {
			...commonInjectionOptions
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

		jobsService: asFunction(
			(c: Cradle) => new JobsService(app.log, c.stacServerClient, c.regionsClient, c.sqsClient, queueUrl, sentinelApiUrl, sentinelCollection),
			{
				...commonInjectionOptions,
			}
		),

		stacServerClient: asFunction(
			(c: Cradle) => new StacServerClient(app.log, c.snsClient, stacServerTopicArn, stacApiEndpoint, awsRegion),
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

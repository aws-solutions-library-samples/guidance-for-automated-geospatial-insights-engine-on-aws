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
import { DynamoDbUtils } from '@agie/dynamodb-utils';
import { EventPublisher, EXECUTOR_EVENT_SOURCE } from '@agie/events';
import { Invoker } from '@agie/lambda-invoker';
import { registerAuthAwilix } from '@agie/rest-api-authorizer';
import { BatchClient } from '@aws-sdk/client-batch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import pkg from 'aws-xray-sdk';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { EngineRepository } from '../api/engines/repository.js';
import { EngineService } from '../api/engines/service.js';
import { RegistrationRepository } from '../api/registrations/repository.js';
import { RegistrationService } from '../api/registrations/service.js';

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		eventBridgeClient: EventBridgeClient;
		dynamoDbUtils: DynamoDbUtils;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		batchClient: BatchClient;
		regionsClient: RegionsClient;
		lambdaInvoker: Invoker;
		lambdaClient: LambdaClient;
		iamClient: IAMClient;
		s3Client: S3Client;
		eventPublisher: EventPublisher;
		engineRepository: EngineRepository;
		engineService: EngineService;
		registrationRepository: RegistrationRepository;
		registrationService: RegistrationService;
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

class IAMClientFactory {
	public static create(region: string): IAMClient {
		return captureAWSv3Client(new IAMClient({ region }));
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

	registerAuthAwilix(app.log);

	const awsRegion = process.env['AWS_REGION'];
	const regionsApiFunctionName = process.env['REGIONS_API_FUNCTION_NAME'];
	const eventBusName = process.env['EVENT_BUS_NAME'];
	const tableName = process.env['TABLE_NAME'];
	const environment = process.env['ENVIRONMENT'];
	const containerExecutionRoleArn = process.env['CONTAINER_EXECUTION_ROLE_ARN'];

	diContainer.register({
		// Clients
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		dynamoDbUtils: asFunction((c: Cradle) => new DynamoDbUtils(app.log, c.dynamoDBDocumentClient), {
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

		iamClient: asFunction(() => IAMClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		eventPublisher: asFunction((c: Cradle) => new EventPublisher(app.log, c.eventBridgeClient, eventBusName, EXECUTOR_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),

		lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		lambdaInvoker: asFunction((container: Cradle) => new Invoker(app.log, container.lambdaClient), {
			...commonInjectionOptions,
		}),

		regionsClient: asFunction((c: Cradle) => new RegionsClient(app.log, c.lambdaInvoker, regionsApiFunctionName), {
			...commonInjectionOptions,
		}),

		engineRepository: asFunction((c: Cradle) => new EngineRepository(app.log, c.dynamoDBDocumentClient, tableName), {
			...commonInjectionOptions,
		}),

		engineService: asFunction((c: Cradle) => new EngineService(app.log, c.batchClient, c.iamClient, containerExecutionRoleArn, c.engineRepository, c.registrationRepository), {
			...commonInjectionOptions,
		}),

		registrationRepository: asFunction((c: Cradle) => new RegistrationRepository(app.log, c.dynamoDBDocumentClient, tableName), {
			...commonInjectionOptions,
		}),

		registrationService: asFunction((c: Cradle) => new RegistrationService(app.log, c.registrationRepository), {
			...commonInjectionOptions,
		}),

		...commonInjectionOptions,
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

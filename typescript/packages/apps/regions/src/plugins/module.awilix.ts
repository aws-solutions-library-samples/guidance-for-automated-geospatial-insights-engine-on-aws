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

import { EnginesClient } from '@agie/clients';
import { DynamoDbUtils } from '@agie/dynamodb-utils';
import { EventPublisher, REGIONS_EVENT_SOURCE } from '@agie/events';
import { Invoker } from '@agie/lambda-invoker';
import { ApiAuthorizer, registerAuthAwilix } from '@agie/rest-api-authorizer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { SQSClient } from '@aws-sdk/client-sqs';
import { VerifiedPermissionsClient } from '@aws-sdk/client-verifiedpermissions';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import pkg from 'aws-xray-sdk';
import fp from 'fastify-plugin';
import { AggregatorService } from '../aggregator/service.js';
import { GroupRepository } from '../api/groups/repository.js';
import { GroupService } from '../api/groups/service.js';
import { PolygonRepository } from '../api/polygons/repository.js';
import { PolygonService } from '../api/polygons/service.js';
import { PolygonTaskService } from '../api/polygonTasks/service.js';
import { PolygonTaskWorkflowProcessor } from '../api/polygonTasks/workflows/processor.js';
import { RegionRepository } from '../api/regions/repository.js';
import { Region } from '../api/regions/schemas.js';
import { RegionService } from '../api/regions/service.js';
import { RegionTaskService } from '../api/regionTasks/service.js';
import { RegionTaskWorkflowProcessor } from '../api/regionTasks/workflows/processor.js';
import { CommonRepository } from '../api/repository.common.js';
import { CommonService } from '../api/service.common.js';
import { StateRepository } from '../api/states/repository.js';
import { StateService } from '../api/states/service.js';
import { CommonCache, ICommonCache, NoOpCache } from '../common/cache.js';
import { PkType } from '../common/pkTypes.js';
import { TaskItemRepository } from '../common/taskItems/repository.js';
import { TaskItemService } from '../common/taskItems/service.js';
import { TaskRepository } from '../common/tasks/repository.js';
import { TagUtils } from '../tags/tags.util.js';

const { captureAWSv3Client } = pkg;
declare module '@fastify/awilix' {
	interface Cradle {
		commonRepository: CommonRepository;
		commonService: CommonService;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		dynamoDbUtils: DynamoDbUtils;
		eventBridgeClient: EventBridgeClient;
		sqsClient: SQSClient;
		lambdaClient: LambdaClient;
		eventPublisher: EventPublisher;
		groupRepository: GroupRepository;
		groupService: GroupService;
		polygonRepository: PolygonRepository;
		polygonService: PolygonService;
		regionRepository: RegionRepository;
		regionService: RegionService;
		stateRepository: StateRepository;
		stateService: StateService;
		tagUtils: TagUtils;
		apiAuthorizer: ApiAuthorizer;
		lambdaInvoker: Invoker;
		avpClient: VerifiedPermissionsClient;
		aggregatorService: AggregatorService;
		regionTaskRepository: TaskRepository;
		regionTaskService: RegionTaskService;
		regionTaskItemRepository: TaskItemRepository;
		regionTaskItemService: TaskItemService;
		regionTaskWorkflowProcessor: RegionTaskWorkflowProcessor;
		polygonTaskRepository: TaskRepository;
		polygonTaskService: PolygonTaskService;
		polygonTaskItemRepository: TaskItemRepository;
		polygonTaskItemService: TaskItemService;
		polygonTaskWorkflowProcessor: PolygonTaskWorkflowProcessor;
		regionCache: ICommonCache<Region>;
		enginesClient: EnginesClient;
	}
}

class LambdaClientFactory {
	public static create(region: string): LambdaClient {
		return captureAWSv3Client(new LambdaClient({ region }));
	}
}

// factories for instantiation of 3rd party objects
class EventBridgeClientFactory {
	public static create(region: string): EventBridgeClient {
		return captureAWSv3Client(
			new EventBridgeClient({
				region,
			})
		);
	}
}

class SQSClientFactory {
	public static create(region: string): SQSClient {
		return captureAWSv3Client(
			new SQSClient({
				region,
			})
		);
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

export default fp<FastifyAwilixOptions>(async (app): Promise<void> => {
	// first register the DI plugin
	await app.register(fastifyAwilixPlugin, {
		disposeOnClose: true,
		disposeOnResponse: false,
	});

	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON,
	};

	registerAuthAwilix(app.log);

	const awsRegion = process.env['AWS_REGION'];
	const tableName = process.env['TABLE_NAME'];
	const eventBusName = process.env['EVENT_BUS_NAME'];

	const userPoolId = process.env['USER_POOL_ID'];
	const policyStoreId = process.env['POLICY_STORE_ID'];
	const clientId = process.env['CLIENT_ID'];

	const enginesFunctionName = process.env['ENGINES_FUNCTION_NAME'];

	const redisEndpoint = process.env['REDIS_ENDPOINT'];

	// then we can register our classes with the DI container
	diContainer.register({
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),
		sqsClient: asFunction(() => SQSClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),
		dynamoDBDocumentClient: asFunction(() => DynamoDBDocumentClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),
		dynamoDbUtils: asFunction((c: Cradle) => new DynamoDbUtils(app.log, c.dynamoDBDocumentClient), {
			...commonInjectionOptions,
		}),
		tagUtils: asFunction((c: Cradle) => new TagUtils(app.log), {
			...commonInjectionOptions,
		}),
		commonRepository: asFunction((c: Cradle) => new CommonRepository(app.log, c.dynamoDBDocumentClient, tableName), {
			...commonInjectionOptions,
		}),
		commonService: asFunction((c: Cradle) => new CommonService(app.log, c.commonRepository, c.tagUtils), {
			...commonInjectionOptions,
		}),
		groupRepository: asFunction((c: Cradle) => new GroupRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, c.commonRepository), {
			...commonInjectionOptions,
		}),
		groupService: asFunction((c: Cradle) => new GroupService(app.log, c.groupRepository, c.commonService, c.commonRepository, c.eventPublisher), {
			...commonInjectionOptions,
		}),
		regionRepository: asFunction((c: Cradle) => new RegionRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, c.commonRepository), {
			...commonInjectionOptions,
		}),
		regionService: asFunction(
			(c: Cradle) => new RegionService(app.log, c.regionRepository, c.groupService, c.commonService, c.commonRepository, c.eventPublisher, c.regionCache, c.enginesClient),
			{
				...commonInjectionOptions,
			}
		),
		polygonRepository: asFunction((c: Cradle) => new PolygonRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, c.commonRepository, c.stateRepository), {
			...commonInjectionOptions,
		}),
		polygonService: asFunction((c: Cradle) => new PolygonService(app.log, c.polygonRepository, c.regionService, c.commonService, c.commonRepository, c.eventPublisher), {
			...commonInjectionOptions,
		}),
		stateRepository: asFunction((c: Cradle) => new StateRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, c.commonRepository), {
			...commonInjectionOptions,
		}),
		stateService: asFunction(
			(c: Cradle) => new StateService(app.log, c.stateRepository, c.regionService, c.polygonService, c.commonService, c.commonRepository, c.eventPublisher),
			{
				...commonInjectionOptions,
			}
		),
		aggregatorService: asFunction((c: Cradle) => new AggregatorService(app.log, c.regionService, c.groupService), {
			...commonInjectionOptions,
		}),
		eventPublisher: asFunction((c: Cradle) => new EventPublisher(app.log, c.eventBridgeClient, eventBusName, REGIONS_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),

		avpClient: asFunction(() => VerifiedPermissionsClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		apiAuthorizer: asFunction((c: Cradle) => new ApiAuthorizer(app.log, c.avpClient, policyStoreId, userPoolId, clientId), {
			...commonInjectionOptions,
		}),

		regionCache: asFunction((c: Cradle) => (redisEndpoint ? new CommonCache<Region>(app.log, 'Region', redisEndpoint) : new NoOpCache()), {
			...commonInjectionOptions,
		}),

		lambdaClient: asFunction(() => LambdaClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		lambdaInvoker: asFunction((container: Cradle) => new Invoker(app.log, container.lambdaClient), {
			...commonInjectionOptions,
		}),

		enginesClient: asFunction((container: Cradle) => new EnginesClient(app.log, container.lambdaInvoker, enginesFunctionName), {
			...commonInjectionOptions,
		}),

		polygonTaskService: asFunction(
			(c: Cradle) =>
				new PolygonTaskService(
					app.log,
					c.polygonTaskRepository,
					c.commonRepository,
					app.config.TASK_BATCH_SIZE,
					c.sqsClient,
					app.config.TASK_QUEUE_URL,
					app.config.TASK_PARALLEL_LIMIT
				),
			{
				...commonInjectionOptions,
			}
		),

		polygonTaskRepository: asFunction((c: Cradle) => new TaskRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, PkType.PolygonTask), {
			...commonInjectionOptions,
		}),

		polygonTaskWorkflowProcessor: asFunction(
			(c: Cradle) => new PolygonTaskWorkflowProcessor(app.log, c.polygonService, c.polygonTaskService, c.polygonTaskItemService, app.config.TASK_PARALLEL_LIMIT),
			{
				...commonInjectionOptions,
			}
		),

		polygonTaskItemRepository: asFunction((c: Cradle) => new TaskItemRepository(app.log, c.dynamoDBDocumentClient, tableName, PkType.PolygonTask, PkType.PolygonTaskItem), {
			...commonInjectionOptions,
		}),

		polygonTaskItemService: asFunction((c: Cradle) => new TaskItemService(app.log, c.polygonTaskItemRepository), {
			...commonInjectionOptions,
		}),

		regionTaskRepository: asFunction((c: Cradle) => new TaskRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, PkType.RegionTask), {
			...commonInjectionOptions,
		}),

		regionTaskService: asFunction(
			(c: Cradle) =>
				new RegionTaskService(
					app.log,
					c.regionTaskRepository,
					c.commonRepository,
					app.config.TASK_BATCH_SIZE,
					c.sqsClient,
					app.config.TASK_QUEUE_URL,
					app.config.TASK_PARALLEL_LIMIT
				),
			{
				...commonInjectionOptions,
			}
		),

		regionTaskItemRepository: asFunction((c: Cradle) => new TaskItemRepository(app.log, c.dynamoDBDocumentClient, tableName, PkType.RegionTask, PkType.RegionTaskItem), {
			...commonInjectionOptions,
		}),

		regionTaskItemService: asFunction((c: Cradle) => new TaskItemService(app.log, c.regionTaskItemRepository), {
			...commonInjectionOptions,
		}),

		regionTaskWorkflowProcessor: asFunction(
			(c: Cradle) => new RegionTaskWorkflowProcessor(app.log, c.regionService, c.regionTaskService, c.regionTaskItemService, app.config.TASK_PARALLEL_LIMIT),
			{
				...commonInjectionOptions,
			}
		),
	});
});

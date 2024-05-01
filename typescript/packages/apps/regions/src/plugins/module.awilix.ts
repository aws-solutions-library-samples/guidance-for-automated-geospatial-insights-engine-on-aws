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

import { asFunction, Lifetime } from 'awilix';
import fp from 'fastify-plugin';

import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import { EventPublisher, REGIONS_EVENT_SOURCE } from '@arcade/events';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DynamoDBDocumentClient, TranslateConfig } from '@aws-sdk/lib-dynamodb';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import pkg from 'aws-xray-sdk';
import { GroupRepository } from '../api/groups/repository.js';
import { GroupService } from '../api/groups/service.js';
import { RegionRepository } from '../api/regions/repository.js';
import { RegionService } from '../api/regions/service.js';
import { CommonRepository } from '../api/repository.common.js';
import { CommonService } from '../api/service.common.js';
import { StateRepository } from '../api/states/repository.js';
import { StateService } from '../api/states/service.js';
import { ZoneRepository } from '../api/zones/repository.js';
import { ZoneService } from '../api/zones/service.js';
import { TagUtils } from '../tags/tags.util.js';

const { captureAWSv3Client } = pkg;
declare module '@fastify/awilix' {
	interface Cradle {
		eventBridgeClient: EventBridgeClient;
		dynamoDBDocumentClient: DynamoDBDocumentClient;
		dynamoDbUtils: DynamoDbUtils;
		tagUtils: TagUtils;
		commonService: CommonService;
		commonRepository: CommonRepository;
		groupService: GroupService;
		groupRepository: GroupRepository;
		regionService: RegionService;
		regionRepository: RegionRepository;
		zoneService: ZoneService;
		zoneRepository: ZoneRepository;
		stateService: StateService;
		stateRepository: StateRepository;
		eventPublisher: EventPublisher;
	}
}

// factories for instantiation of 3rd party objects
class EventBridgeClientFactory {
	public static create(region: string): EventBridgeClient {
		const eventBridge = captureAWSv3Client(
			new EventBridgeClient({
				region,
			})
		);
		return eventBridge;
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

	const awsRegion = process.env['AWS_REGION'];
	const tableName = process.env['TABLE_NAME'];
	const eventBusName = process.env['EVENT_BUS_NAME'];

	// then we can register our classes with the DI c
	diContainer.register({
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
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
		regionService: asFunction((c: Cradle) => new RegionService(app.log, c.regionRepository, c.groupService, c.commonService, c.commonRepository, c.eventPublisher), {
			...commonInjectionOptions,
		}),
		zoneRepository: asFunction((c: Cradle) => new ZoneRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, c.commonRepository, c.stateRepository), {
			...commonInjectionOptions,
		}),
		zoneService: asFunction((c: Cradle) => new ZoneService(app.log, c.zoneRepository, c.regionService, c.commonService, c.commonRepository, c.eventPublisher), {
			...commonInjectionOptions,
		}),
		stateRepository: asFunction((c: Cradle) => new StateRepository(app.log, c.dynamoDBDocumentClient, tableName, c.dynamoDbUtils, c.commonRepository), {
			...commonInjectionOptions,
		}),
		stateService: asFunction(
			(c: Cradle) => new StateService(app.log, c.stateRepository, c.regionService, c.zoneService, c.commonService, c.commonRepository, c.eventPublisher),
			{
				...commonInjectionOptions,
			}
		),
		eventPublisher: asFunction((c: Cradle) => new EventPublisher(app.log, c.eventBridgeClient, eventBusName, REGIONS_EVENT_SOURCE), {
			...commonInjectionOptions,
		}),
	});
});

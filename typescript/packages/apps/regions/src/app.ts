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

import cors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { fastify } from 'fastify';
import createGroupRoute from './api/groups/create.handler.js';
import deleteGroupRoute from './api/groups/delete.handler.js';
import getGroupRoute from './api/groups/get.handler.js';
import listGroupsRoute from './api/groups/list.handler.js';
import { createGroupRequestBody, editGroupRequestBody, groupList, groupResource } from './api/groups/schemas.js';
import updateGroupRoute from './api/groups/update.handler.js';
import createPolygonRoute from './api/polygons/create.handler.js';
import deletePolygonRoute from './api/polygons/delete.handler.js';
import getPolygonRoute from './api/polygons/get.handler.js';
import listPolygonsRoute from './api/polygons/list.handler.js';
import { createPolygonRequestBody, editPolygonRequestBody, polygonCoordinates, polygonList, polygonResource } from './api/polygons/schemas.js';
import updatePolygonRoute from './api/polygons/update.handler.js';
import createRegionRoute from './api/regions/create.handler.js';
import deleteRegionRoute from './api/regions/delete.handler.js';
import getRegionRoute from './api/regions/get.handler.js';
import listRegionsRoute from './api/regions/list.handler.js';
import { createRegionRequestBody, editRegionRequestBody, regionList, regionResource } from './api/regions/schemas.js';
import updateRegionRoute from './api/regions/update.handler.js';
import createStateRoute from './api/states/create.handler.js';
import deleteStateRoute from './api/states/delete.handler.js';
import getStateRoute from './api/states/get.handler.js';
import listStatesRoute from './api/states/list.handler.js';
import { createStateRequestBody, editStateRequestBody, stateList, stateResource } from './api/states/schemas.js';
import updateStateRoute from './api/states/update.handler.js';
import { handleError } from './common/errors.js';
import { attributes, tags } from './common/schemas.js';
import config from './plugins/config.js';
import moduleAwilix from './plugins/module.awilix.js';
import swagger from './plugins/swagger.js';

import getPolygonTaskItemRoute from './api/polygonTaskItems/get.handler.js';
import listPolygonTaskItemsRoute from './api/polygonTaskItems/list.handler.js';
import createPolygonTaskRoute from './api/polygonTasks/create.handler.js';
import deletePolygonTaskRoute from './api/polygonTasks/delete.handler.js';
import getPolygonTaskRoute from './api/polygonTasks/get.handler.js';
import listPolygonTasksRoute from './api/polygonTasks/list.handler.js';

import getRegionTaskItemRoute from './api/regionTaskItems/get.handler.js';
import listRegionTaskItemsRoute from './api/regionTaskItems/list.handler.js';
import createRegionTaskRoute from './api/regionTasks/create.handler.js';
import deleteRegionTaskRoute from './api/regionTasks/delete.handler.js';
import getRegionTaskRoute from './api/regionTasks/get.handler.js';
import listRegionTasksRoute from './api/regionTasks/list.handler.js';

import { authzPlugin } from '@agie/rest-api-authorizer';
import { taskItemList, taskItemResource } from './common/taskItems/schemas.js';
import { createTaskRequestBody, taskList, taskResource } from './common/tasks/schemas.js';

export const buildApp = async (): Promise<FastifyInstance> => {
	const node_env = process.env['NODE_ENV'] as string;
	const logLevel = process.env['LOG_LEVEL'] as string;
	const envToLogger = {
		local: {
			level: logLevel ?? 'debug',
			transport: {
				target: 'pino-pretty',
				options: {
					translateTime: 'HH:MM:ss Z',
					ignore: 'pid,hostname',
				},
			},
		},
		cloud: {
			level: logLevel ?? 'warn',
		},
	};

	const app = fastify({
		logger: envToLogger[node_env] ?? {
			level: logLevel ?? 'info',
		},
		ajv: {
			customOptions: {
				strict: 'log',
				keywords: ['kind', 'modifier'],
			},
			plugins: [
				// eslint-disable-next-line @typescript-eslint/typedef
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				function (ajv: any) {
					ajv.addKeyword({ keyword: 'x-examples' });
				},
			],
		},
	}).withTypeProvider<TypeBoxTypeProvider>();

	app.setErrorHandler(handleError);

	// register all plugins
	await app.register(config);
	await app.register(swagger);
	await app.register(cors, {});
	await app.register(authzPlugin);
	await app.register(moduleAwilix);
	await app.register(fastifySensible);

	app.addSchema(attributes);
	app.addSchema(tags);
	app.addSchema(polygonCoordinates);

	app.addSchema(createGroupRequestBody);
	app.addSchema(editGroupRequestBody);
	app.addSchema(groupResource);
	app.addSchema(groupList);

	app.addSchema(createRegionRequestBody);
	app.addSchema(editRegionRequestBody);
	app.addSchema(regionResource);
	app.addSchema(regionList);

	app.addSchema(createPolygonRequestBody);
	app.addSchema(editPolygonRequestBody);
	app.addSchema(polygonResource);
	app.addSchema(polygonList);

	app.addSchema(createStateRequestBody);
	app.addSchema(editStateRequestBody);
	app.addSchema(stateResource);
	app.addSchema(stateList);

	app.addSchema(createTaskRequestBody);
	app.addSchema(taskResource);
	app.addSchema(taskList);
	app.addSchema(taskItemResource);
	app.addSchema(taskItemList);

	await app.register(createGroupRoute);
	await app.register(listGroupsRoute);
	await app.register(getGroupRoute);
	await app.register(deleteGroupRoute);
	await app.register(updateGroupRoute);

	await app.register(createRegionRoute);
	await app.register(listRegionsRoute);
	await app.register(getRegionRoute);
	await app.register(deleteRegionRoute);
	await app.register(updateRegionRoute);

	await app.register(createPolygonRoute);
	await app.register(listPolygonsRoute);
	await app.register(getPolygonRoute);
	await app.register(deletePolygonRoute);
	await app.register(updatePolygonRoute);

	await app.register(createStateRoute);
	await app.register(listStatesRoute);
	await app.register(getStateRoute);
	await app.register(deleteStateRoute);
	await app.register(updateStateRoute);

	await app.register(createPolygonTaskRoute);
	await app.register(listPolygonTasksRoute);
	await app.register(getPolygonTaskRoute);
	await app.register(listPolygonTaskItemsRoute);
	await app.register(getPolygonTaskItemRoute);
	await app.register(deletePolygonTaskRoute);

	await app.register(createRegionTaskRoute);
	await app.register(listRegionTasksRoute);
	await app.register(getRegionTaskRoute);
	await app.register(listRegionTaskItemsRoute);
	await app.register(getRegionTaskItemRoute);
	await app.register(deleteRegionTaskRoute);

	return app as unknown as FastifyInstance;
};

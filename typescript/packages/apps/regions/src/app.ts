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
import createZoneRoute from './api/zones/create.handler.js';
import deleteZoneRoute from './api/zones/delete.handler.js';
import getZoneRoute from './api/zones/get.handler.js';
import listZonesRoute from './api/zones/list.handler.js';
import { createZoneRequestBody, editZoneRequestBody, polygon, zoneList, zoneResource } from './api/zones/schemas.js';
import updateZoneRoute from './api/zones/update.handler.js';
import { handleError } from './common/errors.js';
import { attributes, tags } from './common/schemas.js';
import { authzPlugin } from './plugins/authz.js';
import config from './plugins/config.js';
import moduleAwilix from './plugins/module.awilix.js';
import swagger from './plugins/swagger.js';

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
	app.addSchema(polygon);

	app.addSchema(createGroupRequestBody);
	app.addSchema(editGroupRequestBody);
	app.addSchema(groupResource);
	app.addSchema(groupList);

	app.addSchema(createRegionRequestBody);
	app.addSchema(editRegionRequestBody);
	app.addSchema(regionResource);
	app.addSchema(regionList);

	app.addSchema(createZoneRequestBody);
	app.addSchema(editZoneRequestBody);
	app.addSchema(zoneResource);
	app.addSchema(zoneList);

	app.addSchema(createStateRequestBody);
	app.addSchema(editStateRequestBody);
	app.addSchema(stateResource);
	app.addSchema(stateList);

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

	await app.register(createZoneRoute);
	await app.register(listZonesRoute);
	await app.register(getZoneRoute);
	await app.register(deleteZoneRoute);
	await app.register(updateZoneRoute);

	await app.register(createStateRoute);
	await app.register(listStatesRoute);
	await app.register(getStateRoute);
	await app.register(deleteStateRoute);
	await app.register(updateStateRoute);

	return app as unknown as FastifyInstance;
};

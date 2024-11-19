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
import { handleError } from './common/errors.js';
import config from './plugins/config.js';
import moduleAwilix from './plugins/module.awilix.js';
import swagger from './plugins/swagger.js';

import createEngineRoute from './api/engines/create.handler.js';
import deleteEngineRoute from './api/engines/delete.handler.js';
import getEngineRoute from './api/engines/get.handler.js';
import listEnginesRoute from './api/engines/list.handler.js';
import updateEngineRoute from './api/engines/update.handler.js';
import listRegistrationRoute from './api/registrations/list.handler.js';

import { authzPlugin } from '@agie/rest-api-authorizer';
import { engineList, engineNew, engineResource, engineUpdate } from './api/engines/schemas.js';
import { registrationResource, registrationResourceList } from './api/registrations/schemas.js';

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

	app.addSchema(engineNew);
	app.addSchema(engineResource);
	app.addSchema(engineList);
	app.addSchema(engineUpdate);
	app.addSchema(registrationResource);
	app.addSchema(registrationResourceList);

	await app.register(createEngineRoute);
	await app.register(getEngineRoute);
	await app.register(deleteEngineRoute);
	await app.register(listEnginesRoute);
	await app.register(updateEngineRoute);
	await app.register(listRegistrationRoute);

	return app as unknown as FastifyInstance;
};

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

import { Region } from '@agie/clients';
import { AwilixContainer } from 'awilix';
import { Callback, Context, Handler } from 'aws-lambda';
import { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { JobsService } from './jobs/service.js';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const jobsService = di.resolve<JobsService>('jobsService');

export const handler: Handler<Region> = async (event, _context: Context, _callback: Callback) => {
	app.log.debug(`EventBridgeSchdulerLambda > handler > event: ${JSON.stringify(event)}`);
	await jobsService.startJobOnSchedule(event);
	app.log.debug(`EventBridgeSchdulerLambda > handler >exit`);
};

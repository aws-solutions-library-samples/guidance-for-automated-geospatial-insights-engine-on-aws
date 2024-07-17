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

import type { Callback, Context, SQSHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { JobsService } from "./jobs/service.js";
import { StartJobRequest } from "./jobs/model.js";
import dayjs from 'dayjs';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const jobsService = di.resolve<JobsService>('jobsService');
export const handler: SQSHandler = async (event, _context: Context, _callback: Callback) => {
    app.log.info(`SQSLambda > handler > event: ${JSON.stringify(event)}`);
    for (const record of event.Records) {

        const request: StartJobRequest = {
            ...JSON.parse(record.body),
            // convert the SentTimestamp to format understandable by STAC server
            scheduleDateTime: dayjs(parseInt(record.attributes.SentTimestamp)).format('YYYY-MM-DD')
        }

        await jobsService.onStartJobRequest(request)
    }
    app.log.info(`SQSLambda > handler >exit`);
};


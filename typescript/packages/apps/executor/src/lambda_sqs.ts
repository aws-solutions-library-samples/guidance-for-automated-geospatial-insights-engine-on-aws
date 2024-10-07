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

import { StartJobRequest } from '@agie/events';
import type { AwilixContainer } from 'awilix';
import type { Callback, Context, SQSBatchItemFailure, SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { JobsService } from './jobs/service.js';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const jobsService = di.resolve<JobsService>('jobsService');
export const handler: SQSHandler = async (event: SQSEvent, _context: Context, _callback: Callback): Promise<SQSBatchResponse> => {
	app.log.info(`SQSLambda > handler > event: ${JSON.stringify(event)}`);

	const batchItemFailures: SQSBatchItemFailure[] = [];

	for (const record of event.Records) {
		try {
			const payload: StartJobRequest = JSON.parse(record.body);
			await jobsService.onStartJobRequest(payload);
		} catch (error) {
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	app.log.info(`SQSLambda > handler >exit`);

	return { batchItemFailures: batchItemFailures };
};

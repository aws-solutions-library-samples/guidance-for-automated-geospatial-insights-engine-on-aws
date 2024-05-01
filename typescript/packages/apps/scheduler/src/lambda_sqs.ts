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

		await jobsService.start(request)
	}
	app.log.info(`SQSLambda > handler >exit`);
};


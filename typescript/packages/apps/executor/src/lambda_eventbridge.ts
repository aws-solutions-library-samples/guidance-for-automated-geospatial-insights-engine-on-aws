import type { Callback, Context, EventBridgeHandler } from 'aws-lambda';
import type { AwilixContainer } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { JobsService } from "./jobs/service.js";
import { AwsBatchJobStateChange } from "./jobs/model.js";

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const jobsService = di.resolve<JobsService>('jobsService');
export const handler: EventBridgeHandler<"Batch Job State Change", AwsBatchJobStateChange, any> = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);

	if (event['detail-type'] === "Batch Job State Change" && event['source'] === 'aws.batch') {
		await jobsService.onJobStatusChangedEvent({
			status: event.detail.status,
			statusReason: event.detail.statusReason,
			jobArn: event.detail.jobArn,
			jobId: event.detail.jobId
		});
	} else {
		app.log.error(`EventBridgeLambda > handler > Unimplemented event: ${JSON.stringify(event)}`);
	}

	app.log.info(`EventBridgeLambda > handler >exit`);
};

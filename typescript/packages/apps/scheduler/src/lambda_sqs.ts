import { Callback, Context, SQSHandler } from "aws-lambda";
import { FastifyInstance } from "fastify";
import { buildLightApp } from "./app.light.js";
import { AwilixContainer } from "awilix";
import { JobsService } from "./jobs/service.js";


const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const jobsService = di.resolve<JobsService>('jobsService');

export const handler: SQSHandler = async (event, _context: Context, _callback: Callback) => {
	app.log.info(`EventBridgeLambda > handler > event: ${JSON.stringify(event)}`);
	const stacItemList = event.Records.map(o => JSON.parse(o.body));
	await jobsService.startJobOnRegionMatch(stacItemList)
	app.log.info(`EventBridgeLambda > handler >exit`);
};

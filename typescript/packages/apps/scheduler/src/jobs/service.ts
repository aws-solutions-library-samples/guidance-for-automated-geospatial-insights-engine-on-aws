import { BatchClient, SubmitJobCommand } from "@aws-sdk/client-batch";
import { StartJobRequest } from "./model.js";
import ow from 'ow';
import { FastifyBaseLogger } from "fastify";

export class JobsService {
	constructor(readonly log: FastifyBaseLogger, private readonly batchClient: BatchClient, private jobDefinitionArn: string, private jobQueueName: string) {
	}

	public async start(request: StartJobRequest): Promise<void> {
		this.log.debug(`JobsService> start> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.scheduleDateTime, ow.string.nonEmpty);
		ow(request.zoneId, ow.string.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.regionId, ow.string.nonEmpty);
		ow(request.coordinates, ow.array.nonEmpty);

		// trigger the aws batch
		await this.batchClient.send(new SubmitJobCommand({
			containerOverrides: {
				environment: [
					{
						name: 'INPUT_JSON_STRING',
						value: JSON.stringify(request)
					}
				]
			},
			jobDefinition: this.jobDefinitionArn,
			jobName: `${request.regionId}-${request.zoneId}-${request.scheduleDateTime}`,
			jobQueue: this.jobQueueName
		}))

		// TODO: Do we need to create or update result resource in ResultsApi
		this.log.debug(`JobsService> start> exit>`);
	}

}

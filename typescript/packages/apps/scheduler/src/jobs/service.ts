import { LambdaRequestContext, RegionsClient } from '@arcade/clients';
import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import pLimit from 'p-limit';
import { BatchEngineInput, StartJobRequest } from './model.js';

export class JobsService {
	private readonly context: LambdaRequestContext;

	constructor(
		readonly log: FastifyBaseLogger,
		private readonly batchClient: BatchClient,
		private readonly regionsClient: RegionsClient,
		private readonly jobDefinitionArn: string,
		private readonly jobQueueName: string,
		private readonly concurrencyLimit: number
	) {
		this.context = {
			authorizer: {
				claims: {
					identities: JSON.stringify({
						userId: 'schedulerSqsProcessor',
					}),
					email: 'schedulerSqsProcessor',
					'cognito:groups': '/|||reader',
				},
			},
		};
	}

	public async start(request: StartJobRequest): Promise<void> {
		this.log.debug(`JobsService> start> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.scheduleDateTime, ow.string.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.id, ow.string.nonEmpty);

		// get list of polygons for this particular region
		const polygonListResource = await this.regionsClient.listPolygons({ regionId: request.id }, this.context);

		if (polygonListResource.polygons.length === 0) {
			this.log.warn(`JobsService> start> no polygon associated with the region ${request.name}}`);
			return;
		}

		const limit = pLimit(this.concurrencyLimit);

		// run engine processing for each polygon
		const runEngineFutures = polygonListResource.polygons.map((polygon) => {
			const containerEngineInput: BatchEngineInput = {
				...request,
				coordinates: polygon.boundary,
				exclusions: polygon.exclusions,
				polygonId: polygon.id,
				regionId: request.id,
			};

			const jobName = `${request.id}-${polygon.id}-${request.scheduleDateTime}`;

			return limit(() =>
				this.batchClient.send(
					new SubmitJobCommand({
						containerOverrides: {
							environment: [
								{
									name: 'INPUT_JSON_STRING',
									value: JSON.stringify(containerEngineInput),
								},
							],
						},
						jobDefinition: this.jobDefinitionArn,
						jobName,
						jobQueue: this.jobQueueName,
					})
				)
			);
		});

		await Promise.any(runEngineFutures);

		// TODO: Do we need to create or update result resource in ResultsApi
		this.log.debug(`JobsService> start> exit>`);
	}
}

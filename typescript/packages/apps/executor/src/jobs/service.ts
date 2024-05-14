import { LambdaRequestContext, Polygon, RegionsClient } from '@arcade/clients';
import { BatchClient, ListTagsForResourceCommand, SubmitJobCommand, SubmitJobCommandInput } from '@aws-sdk/client-batch';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import pLimit from 'p-limit';
import { BatchEngineInput, FinishJobRequest, StartJobRequest } from './model.js';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ARCADE_EVENT_SOURCE, DomainEvent, EngineJobDetails, EngineType, EventPublisher, Status } from "@arcade/events";
import { ulid } from 'ulid';

const filename = 'metadata.json'

export class JobsService {
	private readonly context: LambdaRequestContext;
	private readonly engineType: EngineType;

	constructor(
		readonly log: FastifyBaseLogger,
		private readonly batchClient: BatchClient,
		private readonly regionsClient: RegionsClient,
		private readonly jobDefinitionArn: string,
		private readonly jobQueueName: string,
		private readonly concurrencyLimit: number,
		private readonly bucketName: string,
		private readonly s3Client: S3Client,
		readonly eventPublisher: EventPublisher
	) {
		this.engineType = 'aws-batch';
		this.context = {
			authorizer: {
				claims: {
					email: 'schedulerSqsProcessor',
					"custom:role": 'reader'
				},
			},
		};
	}

	private async uploadFileForBatchJob(params: { resultId: string, polygons: Polygon[], request: StartJobRequest, keyPrefix: string }) {
		this.log.debug(`JobsService> uploadFileForBatchJob> params: ${JSON.stringify(params)}`);
		const { request, resultId, keyPrefix, polygons } = params
		const limit = pLimit(this.concurrencyLimit);
		// run engine processing for each polygon
		const createInputFilesForBatchProcessorFutures = polygons.map((polygon, index) => {
			const containerEngineInput: BatchEngineInput = {
				...request,
				coordinates: polygon.boundary,
				exclusions: polygon.exclusions,
				polygonId: polygon.id,
				regionId: request.id,
				resultId: resultId,
				state: polygon.state,
				outputPrefix: `${keyPrefix}/output/polygon=${polygon.id}`
			};

			return limit(() => {
					this.s3Client.send(new PutObjectCommand({ Bucket: this.bucketName, Key: `${keyPrefix}/input/${index}/${filename}`, Body: JSON.stringify(containerEngineInput) }))
				}
			);
		});

		await Promise.all(createInputFilesForBatchProcessorFutures)
		this.log.debug(`JobsService> uploadFileForBatchJob> exit>`);
	}

	private async submitBatchJob(params: { resultId: string, polygons: Polygon[], request: StartJobRequest, keyPrefix: string }) {
		this.log.debug(`JobsService> submitBatchJob> params: ${JSON.stringify(params)}`);
		const { request, resultId, keyPrefix, polygons } = params

		await this.uploadFileForBatchJob(params);

		const command: SubmitJobCommandInput = {
			containerOverrides: {
				environment: [
					{
						name: 'INPUT_PREFIX',
						value: `${keyPrefix}/input`,
					},
					{
						name: 'INPUT_FILENAME',
						value: filename,
					},
				],
			},
			jobName: `${request.id}-${request.scheduleDateTime}`,
			jobDefinition: this.jobDefinitionArn,
			jobQueue: this.jobQueueName,
			tags: {
				regionId: request.id,
				resultId: resultId,
				scheduleDateTime: request.scheduleDateTime,
				createdBy: ARCADE_EVENT_SOURCE
			}
		}

		if (polygons.length > 1) {
			// aws batch array does not work with less than 1 task
			command.arrayProperties = {
				size: polygons.length
			}
		} else {
			// the input will be written to a prefix that ends with '0' if there is only one task
			command.containerOverrides.environment.push({ name: 'AWS_BATCH_JOB_ARRAY_INDEX', value: '0' })
		}
		// Trigger the aws batch job
		const submitCommand = await this.batchClient.send(
			new SubmitJobCommand(command)
		)

		this.log.debug(`JobsService> submitBatchJob> exit>`);
		return submitCommand.jobId
	}

	public async onJobStatusChangedEvent(request: FinishJobRequest): Promise<void> {
		this.log.info(`JobsService> onJobStatusChangedEvent> in> request: ${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.jobArn, ow.string.nonEmpty);
		ow(request.jobId, ow.string.nonEmpty);
		ow(request.status, ow.string.nonEmpty);
		ow(request.statusReason, ow.optional.string);

		// Query the arcade resources from the tag
		const listTagsResponse = await this.batchClient.send(new ListTagsForResourceCommand({ resourceArn: request.jobArn }))
		const { regionId, scheduleDateTime, resultId } = listTagsResponse.tags;

		let status: Status, eventDetail: DomainEvent<EngineJobDetails>
		switch (request.status) {
			case 'SUBMITTED':
			case 'PENDING':
			case 'RUNNABLE':
				status = 'queued';
				break;
			case 'STARTING':
				status = 'starting';
				break;
			case 'RUNNING':
				status = 'inProgress';
				break;
			case 'SUCCEEDED':
				status = 'succeeded';
				break;
			case 'FAILED':
				status = 'failed';
				break;
		}

		if (status === 'queued') {
			eventDetail = {
				eventType: 'created',
				id: resultId,
				resourceType: 'Job',
				new: {
					regionId: regionId,
					id: resultId,
					scheduleDateTime: scheduleDateTime,
					executionId: request.jobId,
					message: request.statusReason,
					engineType: this.engineType,
					status,
				}
			}
		} else {
			eventDetail = {
				eventType: 'updated',
				id: resultId,
				resourceType: 'Job',
				new: {
					regionId: regionId,
					id: resultId,
					message: request.statusReason,
					status,
				}
			}
		}
		await this.eventPublisher.publishEvent<EngineJobDetails>(eventDetail)
		this.log.info(`JobsService> onJobStatusChangedEvent> exit> `);
	}

	public async onStartJobRequest(request: StartJobRequest): Promise<void> {
		this.log.debug(`JobsService> start> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.scheduleDateTime, ow.string.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.id, ow.string.nonEmpty);

		// get list of polygons for this particular region
		const polygonListResource = await this.regionsClient.listPolygons({ regionId: request.id, includeLatestState: true }, this.context);
		if (polygonListResource.polygons.length === 0) {
			this.log.warn(`JobsService> start> no polygon associated with the region ${request.name}}`);
			return;
		}
		const resultId = ulid().toLowerCase();
		try {
			const keyPrefix = `region=${request.id}/result=${resultId}`
			await this.submitBatchJob({ resultId, polygons: polygonListResource.polygons, request, keyPrefix });
		} catch (exception) {
			await this.eventPublisher.publishEvent<EngineJobDetails>({
				eventType: 'created',
				id: resultId,
				resourceType: 'Job',
				new: {
					regionId: request.id,
					id: resultId,
					scheduleDateTime: request.scheduleDateTime,
					engineType: this.engineType,
					status: 'failed',
					message: exception.message
				}
			})
		}

		this.log.debug(`JobsService> start> exit>`);
	}
}

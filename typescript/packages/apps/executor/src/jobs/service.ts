import { LambdaRequestContext, Polygon, RegionsClient, ResultResource, ResultsClient } from '@arcade/clients';
import { BatchClient, ListTagsForResourceCommand, SubmitJobCommand, SubmitJobCommandInput } from '@aws-sdk/client-batch';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import pLimit from 'p-limit';
import { BatchEngineInput, FinishJobRequest, JobQueueArn, StartJobRequest } from './model.js';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ARCADE_EVENT_SOURCE, DomainEvent, EngineJobDetails, EngineType, EventPublisher, Priority, Status } from "@arcade/events";
import { ulid } from 'ulid';
import dayjs from 'dayjs';

const filename = 'metadata.json'

export class JobsService {
	private readonly context: LambdaRequestContext;
	private readonly engineType: EngineType;

	constructor(
		readonly log: FastifyBaseLogger,
		readonly batchClient: BatchClient,
		readonly regionsClient: RegionsClient,
		readonly jobDefinitionArn: string,
		readonly queuePriorityMap: Record<Priority, JobQueueArn>,
		readonly concurrencyLimit: number,
		readonly bucketName: string,
		readonly s3Client: S3Client,
		readonly eventPublisher: EventPublisher,
		readonly resultsClient: ResultsClient
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

	private async uploadFileForBatchJob(params: {
		request: StartJobRequest,
		resultId: string,
		polygons: Polygon[],
		keyPrefix: string,
		latestSuccessfulResult?: ResultResource
	}) {
		this.log.debug(`JobsService> uploadFileForBatchJob> params: ${JSON.stringify(params)}`);
		const { request, resultId, keyPrefix, polygons, latestSuccessfulResult } = params
		const limit = pLimit(this.concurrencyLimit);

		const group = await this.regionsClient.getGroupById(request.groupId, this.context);

		// run engine processing for each polygon
		const createInputFilesForBatchProcessorFutures = polygons.map((polygon, index) => {
			const containerEngineInput: BatchEngineInput = {
				...request,
				coordinates: polygon.boundary,
				exclusions: polygon.exclusions,
				groupId: request.groupId,
				groupName: group.name,
				polygonId: polygon.id,
				polygonName: polygon.name,
				regionId: request.id,
				regionName: request.name,
				resultId: resultId,
				state: polygon.state,
				latestSuccessfulResult,
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

	private async submitBatchJob(params: {
		resultId: string,
		polygons: Polygon[],
		latestSuccessfulResult?: ResultResource
		request: StartJobRequest,
	}) {
		this.log.debug(`JobsService> submitBatchJob> params: ${JSON.stringify(params)}`);
		const { request, resultId, polygons } = params

		const keyPrefix = `region=${request.id}/result=${resultId}`

		await this.uploadFileForBatchJob({ ...params, keyPrefix });

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
			jobQueue: this.queuePriorityMap[request.processingConfig.priority],
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
		ow(request.processingConfig, ow.object.nonEmpty);
		ow(request.processingConfig.priority, ow.string.nonEmpty);

		// Retrieve all polygons belonging to the region
		let listPolygonsKeepGoing = true, listPolygonsToken: string;
		const polygons: Polygon[] = [];
		while (listPolygonsKeepGoing) {
			let options = { regionId: request.id, includeLatestState: true };
			if (listPolygonsToken) {
				options['paginationToken'] = listPolygonsToken;
			}
			const polygonListResource = await this.regionsClient.listPolygons(options, this.context);
			polygons.push(...polygonListResource.polygons);
			listPolygonsToken = polygonListResource.pagination?.token;
			listPolygonsKeepGoing = listPolygonsToken !== undefined;
		}

		if (polygons.length === 0) {
			this.log.warn(`JobsService> start> no polygon associated with the region ${request.name}}`);
			return;
		}

		// Retrieve latest result
		let keepGoing = true, token: string, latestSuccessfulResult: ResultResource;
		while (keepGoing) {
			let options = {};
			if (token) {
				options['paginationToken'] = token;
			}
			const response = await this.resultsClient.listResults(request.id, options, this.context);
			for (const result of response.results) {
				if (result.status === 'succeeded') {
					latestSuccessfulResult = result;
					// only include the result if region has not been updated since last successful run
					if (request.updatedAt && dayjs(request.updatedAt).isBefore(dayjs(result.createdAt))) {
						latestSuccessfulResult = result;
					}
					keepGoing = false;
					break;
				}
			}
			token = response.pagination?.lastEvaluatedToken;
			keepGoing = token !== undefined;
		}

		const resultId = ulid().toLowerCase();
		try {
			await this.submitBatchJob({
				resultId,
				request,
				latestSuccessfulResult,
				polygons
			});
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

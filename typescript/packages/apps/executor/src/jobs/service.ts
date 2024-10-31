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

import { LambdaRequestContext, Polygon, RegionsClient } from '@agie/clients';
import { AGIE_EVENT_SOURCE, DomainEvent, EngineJobDetails, EngineType, EventPublisher, FinishJobRequest, Priority, StartJobRequest, Status } from '@agie/events';
import { InvalidRequestError } from '@agie/resource-api-base';
import { BatchClient, ListTagsForResourceCommand, SubmitJobCommand, SubmitJobCommandInput } from '@aws-sdk/client-batch';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import pLimit from 'p-limit';
import { ulid } from 'ulid';
import { ExecutionTaskItemService } from '../taskItems/service.js';
import { ExecutionTaskService } from '../tasks/service.js';
import { BatchEngineInput, JobQueueArn } from './model.js';

const filename = 'metadata.json';

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
		readonly executionTaskService: ExecutionTaskService,
		readonly executionTaskItemService: ExecutionTaskItemService
	) {
		this.engineType = 'aws-batch';
		this.context = {
			authorizer: {
				claims: {
					email: 'schedulerSqsProcessor',
					'custom:role': 'reader',
				},
			},
		};
	}

	public async onJobStatusChangedEvent(request: FinishJobRequest): Promise<void> {
		this.log.info(`JobsService> onJobStatusChangedEvent> in> request: ${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.jobArn, ow.string.nonEmpty);
		ow(request.jobId, ow.string.nonEmpty);
		ow(request.status, ow.string.nonEmpty);
		ow(request.statusReason, ow.optional.string);

		let status: Status;
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

		// Query the agie resources from the tag
		const listTagsResponse = await this.batchClient.send(new ListTagsForResourceCommand({ resourceArn: request.jobArn }));

		const { regionId, startDateTime, endDateTime, resultId, taskId } = listTagsResponse.tags;

		if (taskId) await this.updateExecutionTask({ taskId, status, regionId, startDateTime, statusMessage: request.statusReason, resultId });

		await this.publishEvent(status, resultId, regionId, startDateTime, endDateTime, request);

		this.log.info(`JobsService> onJobStatusChangedEvent> exit> `);
	}

	private async updateExecutionTask(taskUpdate: { taskId: string; status: string; regionId: string; startDateTime: string; resultId?: string; statusMessage?: string }) {
		this.log.info(`JobsService> updateExecutionTask> in> taskUpdate: ${JSON.stringify(taskUpdate)} `);

		const { taskId, status, regionId, statusMessage, resultId, startDateTime } = taskUpdate;

		switch (taskUpdate.status) {
			case 'inProgress':
				await this.executionTaskService.updateTaskStatus(taskUpdate.taskId, 'inProgress');
				break;
			case 'failed':
			case 'succeeded':
				let itemsFailed = 0,
					itemsSucceeded = 1,
					taskItemStatus: 'success' | 'failure' = 'success';

				if (status === 'failed') {
					itemsFailed = 1;
					itemsSucceeded = 0;
					taskItemStatus = 'failure';
				}

				// create the task item resource
				await this.executionTaskItemService.create({
					regionId,
					startDateTime: startDateTime,
					taskId: taskId,
					status: taskItemStatus,
					statusMessage: statusMessage,
					resultId,
				});

				// update the task progress
				await this.executionTaskService.updateTaskProgress({
					taskId: taskId,
					itemsFailed,
					itemsSucceeded,
				});

				// update the task status to success, the method has condition expression to only update to success once task item had been ran
				await this.executionTaskService.updateTaskStatus(taskId, 'success');

				break;
			default:
				break;
		}

		this.log.info(`JobsService> updateExecutionTask> exit>`);
	}

	private async publishEvent(status: Status, resultId: string, regionId: string, startDateTime: string, endDateTime: string, request: FinishJobRequest) {
		this.log.debug(
			`JobsService> publishEvent> in> status: ${status}, resultId: ${resultId}, regionId: ${regionId}, startDateTime: ${startDateTime}, endDateTime: ${endDateTime}, request:${JSON.stringify(
				request
			)}`
		);

		let eventDetail: DomainEvent<EngineJobDetails>;
		if (status === 'queued') {
			eventDetail = {
				eventType: 'created',
				id: resultId,
				resourceType: 'Job',
				new: {
					regionId: regionId,
					id: resultId,
					startDateTime,
					endDateTime,
					executionId: request.jobId,
					message: request.statusReason,
					engineType: this.engineType,
					status,
				},
			};
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
				},
			};
		}
		await this.eventPublisher.publishEvent<EngineJobDetails>(eventDetail);

		this.log.debug(`JobsService> publishEvent> exit>`);
	}

	public async onStartJobRequest(request: StartJobRequest): Promise<void> {
		this.log.debug(`JobsService> start> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		ow(request.processingConfig, ow.object.nonEmpty);
		ow(request.processingConfig.priority, ow.string.nonEmpty);

		const resultId = ulid().toLowerCase();

		let taskStatus = 'inProgress',
			taskStatusMessage: string;

		try {
			// Retrieve all polygons belonging to the region
			const polygons: Polygon[] = await this.retrievePolygons(request.id);
			if (polygons.length === 0) {
				this.log.warn(`JobsService> start> no polygon associated with the region ${request.name}`);
				throw new InvalidRequestError('no polygon associated with the region ${request.name}');
			}
			await this.submitBatchJob({
				resultId,
				request,
				polygons,
			});
		} catch (exception) {
			await this.eventPublisher.publishEvent<EngineJobDetails>({
				eventType: 'created',
				id: resultId,
				resourceType: 'Job',
				new: {
					regionId: request.id,
					id: resultId,
					startDateTime: request.startDateTime,
					endDateTime: request.endDateTime,
					engineType: this.engineType,
					status: 'failed',
					message: exception.message,
				},
			});

			taskStatus = 'failed';
		} finally {
			// if there is taskId associated with the job update the task and taskItem status
			if (request.taskId) {
				await this.updateExecutionTask({
					regionId: request.id,
					startDateTime: request.startDateTime,
					taskId: request.taskId,
					statusMessage: taskStatusMessage,
					resultId,
					status: taskStatus,
				});
			}
		}

		this.log.debug(`JobsService> start> exit>`);
	}

	private async retrievePolygons(regionId: string): Promise<Polygon[]> {
		this.log.debug(`JobsService> retrievePolygons> regionId: ${regionId}`);

		let keepGoing = true,
			nextToken: string;

		const polygons: Polygon[] = [];

		while (keepGoing) {
			let options = { regionId, includeLatestState: true };
			if (nextToken) {
				options['paginationToken'] = nextToken;
			}
			const polygonListResource = await this.regionsClient.listPolygons(options, this.context);
			polygons.push(...polygonListResource.polygons);
			nextToken = polygonListResource.pagination?.token;
			keepGoing = nextToken !== undefined;
		}

		this.log.debug(`JobsService> retrievePolygons> exit> polygons: ${JSON.stringify(polygons)}`);
		return polygons;
	}

	private async uploadFileForBatchJob(params: { request: StartJobRequest; resultId: string; polygons: Polygon[]; keyPrefix: string }) {
		this.log.debug(`JobsService> uploadFileForBatchJob> params: ${JSON.stringify(params)}`);
		const { request, resultId, keyPrefix, polygons } = params;
		const limit = pLimit(this.concurrencyLimit);

		const group = await this.regionsClient.getGroupById(request.groupId, this.context);

		// run engine processing for each polygon
		const createInputFilesForBatchProcessorFutures = polygons.map((polygon, index) => {
			const containerEngineInput: BatchEngineInput = {
				endDateTime: request.endDateTime,
				startDateTime: request.startDateTime,
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
				outputPrefix: `${keyPrefix}/output/polygon=${polygon.id}`,
			};

			return limit(async () => {
				await this.s3Client.send(
					new PutObjectCommand({ Bucket: this.bucketName, Key: `${keyPrefix}/input/${index}/${filename}`, Body: JSON.stringify(containerEngineInput) })
				);
			});
		});

		await Promise.all(createInputFilesForBatchProcessorFutures);
		this.log.debug(`JobsService> uploadFileForBatchJob> exit>`);
	}

	private async submitBatchJob(params: { resultId: string; polygons: Polygon[]; request: StartJobRequest }) {
		this.log.debug(`JobsService> submitBatchJob> params: ${JSON.stringify(params)}`);
		const { request, resultId, polygons } = params;

		const keyPrefix = `region=${request.id}/result=${resultId}`;

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
			jobName: `${request.id}-${dayjs(request.endDateTime).unix()}`,
			jobDefinition: this.jobDefinitionArn,
			jobQueue: this.queuePriorityMap[request.processingConfig.priority],
			tags: {
				regionId: request.id,
				resultId: resultId,
				startDateTime: request.startDateTime,
				endDateTime: request.endDateTime,
				taskId: request.taskId,
				createdBy: AGIE_EVENT_SOURCE,
			},
		};

		if (polygons.length > 1) {
			// aws batch array does not work with less than 1 task
			command.arrayProperties = {
				size: polygons.length,
			};
		} else {
			// the input will be written to a prefix that ends with '0' if there is only one task
			command.containerOverrides.environment.push({ name: 'AWS_BATCH_JOB_ARRAY_INDEX', value: '0' });
		}
		// Trigger the aws batch job
		const submitCommand = await this.batchClient.send(new SubmitJobCommand(command));

		this.log.debug(`JobsService> submitBatchJob> exit>`);
		return submitCommand.jobId;
	}
}

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

import { RegionsClient } from '@agie/clients';
import { StartJobRequest } from '@agie/events';
import { InvalidRequestError, NotFoundError } from '@agie/resource-api-base';
import { SecurityContext } from '@agie/rest-api-authorizer';
import { SendMessageCommand, SendMessageCommandOutput, SQSClient } from '@aws-sdk/client-sqs';
import dayjs from 'dayjs';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import pLimit from 'p-limit';
import { ulid } from 'ulid';
import { ListPaginationOptions } from '../common/schemas.js';
import { ExecutionTaskRepository } from './repository.js';
import { TaskBatchProgress, TaskNew, TaskResource } from './schemas.js';

export class ExecutionTaskService {
	constructor(
		private readonly logger: FastifyBaseLogger,
		private readonly repository: ExecutionTaskRepository,
		private readonly regionsClient: RegionsClient,
		private readonly sqs: SQSClient,
		private readonly sqsQueueUrl: string,
		private readonly concurrencyLimit: number
	) {}

	public async updateTaskStatus(taskId: string, status: string): Promise<void> {
		this.logger.debug(`ExecutionTaskService> updateTaskProgress> in: taskId: ${taskId} status:${status}`);
		ow(taskId, ow.string.nonEmpty);
		ow(status, ow.string.oneOf(['success', 'failure', 'inProgress']));

		await this.repository.updateStatus(taskId, status);

		this.logger.debug(`ExecutionTaskService> update> exit`);
	}

	public async updateTaskProgress(taskBatchProgress: TaskBatchProgress): Promise<void> {
		this.logger.debug(`ExecutionTaskService> updateTaskProgress> in: taskBatchProgress:${JSON.stringify(taskBatchProgress)}`);

		ow(
			taskBatchProgress,
			ow.object.partialShape({
				taskId: ow.string.nonEmpty,
				itemsFailed: ow.number.greaterThanOrEqual(0),
				itemsSucceeded: ow.number.greaterThanOrEqual(0),
			})
		);

		await this.repository.updateProgress(taskBatchProgress);

		this.logger.debug(`ExecutionTaskService> update> exit`);
	}

	public async list(securityContext: SecurityContext, options: ListPaginationOptions) {
		this.logger.debug(`ExecutionTaskService> list> options: ${JSON.stringify(options)}`);

		ow(securityContext, ow.object.nonEmpty);
		ow(securityContext.sub, ow.string.nonEmpty);

		return await this.repository.list(securityContext.sub, options);
	}

	public async get(securityContext: SecurityContext, taskId: string) {
		this.logger.debug(`ExecutionTaskService> get> taskId: ${taskId}`);

		ow(taskId, ow.string.nonEmpty);

		const executionTask = await this.repository.get(taskId);

		if (!executionTask) throw new NotFoundError(`Could not find execution task with id: ${taskId}`);

		this.logger.debug(`ExecutionTaskService> get> exit> executionTask: ${JSON.stringify(executionTask)}`);
		return executionTask;
	}

	public async create(securityContext: SecurityContext, newExecutionTask: TaskNew): Promise<TaskResource> {
		this.logger.debug(`ExecutionTaskService> create> newExecutionTask: ${JSON.stringify(newExecutionTask)}`);

		ow(newExecutionTask.regionId, ow.string.nonEmpty);
		ow(newExecutionTask.startDateTime, ow.string.nonEmpty);
		ow(newExecutionTask.endDateTime, ow.string.nonEmpty);
		ow(newExecutionTask.interval.duration, ow.number.greaterThan(0));
		ow(newExecutionTask.interval.unit, ow.string.nonEmpty);

		const { regionId, startDateTime, endDateTime, interval } = newExecutionTask;

		let taskStartDate = dayjs(startDateTime);
		let taskEndDate = dayjs(endDateTime);

		if (taskEndDate <= taskStartDate) {
			throw new InvalidRequestError(`endDateTime should be larger than startDateTime`);
		}

		// This will throws exception when region does not exist
		const region = await this.regionsClient.getRegionById(regionId, {
			authorizer: {
				claims: {
					email: securityContext.email,
					'custom:role': `/|||${securityContext.role}`,
				},
			},
		});

		if (!region) {
			throw new InvalidRequestError(`Region ${regionId} not found.`);
		}

		const taskItems: StartJobRequest[] = [];
		const taskId = ulid().toLowerCase();

		let keepGoing = true;
		let jobStartDate: dayjs.Dayjs, jobEndDate: dayjs.Dayjs;
		while (keepGoing) {
			jobStartDate = jobEndDate?.clone() ?? taskStartDate.clone();
			jobEndDate = jobStartDate.add(interval.duration, interval.unit);

			const taskDetails: StartJobRequest = {
				...region,
				startDateTime: jobStartDate.toISOString(),
				endDateTime: jobEndDate.toISOString(),
				taskId: taskId,
			};

			taskItems.push(taskDetails);

			if (jobEndDate > taskEndDate) {
				keepGoing = false;
			}
		}

		// send each batch of activities to sqs for async processing
		const sqsFutures: Promise<SendMessageCommandOutput>[] = [];
		const limit = pLimit(this.concurrencyLimit);
		for (const batch of taskItems) {
			sqsFutures.push(
				limit(
					async () =>
						await this.sqs.send(
							new SendMessageCommand({
								QueueUrl: this.sqsQueueUrl,
								MessageBody: JSON.stringify(batch),
								MessageGroupId: region.id,
								// use the region id and startDateTime as the message deduplication id to prevent duplicate processing of the same region.
								MessageDeduplicationId: `${taskId}-${regionId}-${batch.startDateTime}`,
							})
						)
				)
			);
		}

		// building the activity task
		const task: TaskResource = {
			...newExecutionTask,
			id: taskId,
			itemsTotal: taskItems.length,
			itemsCompleted: 0,
			itemsFailed: 0,
			itemsSucceeded: 0,
			taskStatus: 'waiting',
			createdAt: new Date(Date.now()).toISOString(),
			createdBy: securityContext.email,
		};

		try {
			await Promise.all(sqsFutures);
		} catch (exception) {
			task.taskStatus = 'failure';
			task.statusMessage = exception.message;
		} finally {
			await this.repository.create(securityContext.sub, task);
		}

		return task;
	}
}

import { FastifyBaseLogger } from "fastify";
import { SecurityContext } from "../../common/scopes.js";
import { CreateTaskRequestBody, ResourceType, TaskBatch, TaskBatchProgress, TaskResource } from "./schemas.js";
import { ulid } from "ulid";
import { SendMessageCommand, SendMessageCommandOutput, SQSClient } from "@aws-sdk/client-sqs";
import pLimit from 'p-limit';
import { NotFoundError } from "../../common/errors.js";
import { TaskRepository } from "./repository.js";
import { CommonRepository, ResourceId } from "../../api/repository.common.js";
import { ListPaginationOptions } from "../../api/service.common.js";
import { PkType } from "../pkTypes.js";
import ow from 'ow';

export abstract class TaskService {
	public constructor(protected readonly log: FastifyBaseLogger,
					   private readonly repository: TaskRepository,
					   private readonly commonRepository: CommonRepository,
					   private readonly batchSize: number,
					   private readonly sqsClient: SQSClient,
					   private readonly sqsQueueUrl: string,
					   private readonly concurrencyLimit: number,
					   private readonly taskPrefix: string,
					   private readonly resourceType: ResourceType) {
	}

	// Different resource task will need to implement its own validation
	abstract validate(request: CreateTaskRequestBody): void;

	public async updateTaskProgress(taskBatchProgress: TaskBatchProgress): Promise<void> {
		this.log.debug(`TaskService> updateTaskProgress> in: taskUpdate:${JSON.stringify(taskBatchProgress)}`);
		ow(taskBatchProgress, ow.object.nonEmpty);
		ow(taskBatchProgress, ow.object.exactShape({
			taskId: ow.string.nonEmpty,
			totalItems: ow.number.greaterThanOrEqual(0),
			itemsFailed: ow.number.greaterThanOrEqual(0),
			itemsSucceeded: ow.number.greaterThanOrEqual(0)
		}));
		await this.repository.updateProgress(taskBatchProgress);
		this.log.debug(`TaskService> update> exit`);
	}

	public async updateTaskStatus(taskId: string, status: string): Promise<void> {
		this.log.debug(`TaskService> updateTaskProgress> in: taskId: ${taskId} status:${status}`);
		ow(taskId, ow.string.nonEmpty);
		ow(status, ow.string.oneOf(['waiting', 'inProgress', 'success', 'failure']));
		await this.repository.updateStatus(taskId, status);
		this.log.debug(`TaskService> update> exit`);
	}

	public async list(securityContext: SecurityContext, options: ListPaginationOptions): Promise<[TaskResource[], ResourceId]> {
		this.log.debug(`TaskService> list> in> options:${JSON.stringify(options)}`);
		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)
		const [polygonTaskIds, paginationKey] = await this.commonRepository.listResourceIds(this.taskPrefix as PkType, options);
		const polygonTasks = await this.repository.listByIds(polygonTaskIds);

		this.log.debug(`TaskService> list> exit:${JSON.stringify([polygonTasks, paginationKey])}`);
		return [polygonTasks, paginationKey];
	}

	public async get(securityContext: SecurityContext, taskId: string): Promise<TaskResource> {
		this.log.debug(`TaskService> get> taskId Id: ${taskId}`);
		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)
		// retrieve task
		const task = await this.repository.get(taskId);
		if (task === undefined) {
			throw new NotFoundError(`task with id:'${taskId}' not found.`);
		}
		this.log.debug(`TaskService> get> exit:${JSON.stringify(task)}`);
		return task;
	}

	public async delete(securityContext: SecurityContext, taskId: string): Promise<void> {
		this.log.debug(`TaskService> delete> in> taskId: ${taskId}`);
		ow(taskId, ow.string.nonEmpty);
		// retrieve and verify activity task is permissible to group
		await this.get(securityContext, taskId);
		// save
		await this.repository.delete(taskId);

		this.log.debug(`TaskService> delete> exit:`);
	}

	public async create(securityContext: SecurityContext, createRequest: CreateTaskRequestBody): Promise<TaskResource> {
		this.log.debug(`TaskService> create> createRequest:${createRequest}`);
		// TODO: permission check (or will this be part of apigw/cognito integration with verified permissions?)
		// validation
		this.validate(createRequest);
		const batcher = <T>(items: T[]) =>
			items.reduce((chunks: T[][], item: T, index) => {
				const chunk = Math.floor(index / this.batchSize);
				chunks[chunk] = ([] as T[]).concat(chunks[chunk] || [], item);
				return chunks;
			}, []);

		const batches = batcher<any>(createRequest.items);

		// building the activity task
		const task: TaskResource = {
			taskType: createRequest.taskType,
			id: ulid().toLowerCase(),
			itemsTotal: createRequest.items.length,
			itemsFailed: 0,
			itemsSucceeded: 0,
			batchesCompleted: 0,
			batchesTotal: batches.length,
			taskStatus: 'waiting',
			createdAt: new Date(Date.now()).toISOString(),
			createdBy: securityContext.email,
		};

		// save
		await this.repository.create(task);

		const taskBatches = batches.map((c) => {
			const taskBatch: TaskBatch = {
				taskId: task.id,
				type: task.taskType,
				securityContext: securityContext,
				items: c,
			};
			return taskBatch;
		});

		// send each batch of activities to sqs for async processing
		const sqsFutures: Promise<SendMessageCommandOutput>[] = [];
		const limit = pLimit(this.concurrencyLimit);
		for (const batch of taskBatches) {
			sqsFutures.push(
				limit(() =>
					this.sqsClient.send(
						new SendMessageCommand({
							QueueUrl: this.sqsQueueUrl,
							MessageBody: JSON.stringify(batch),
							MessageAttributes: {
								messageType: {
									DataType: 'String',
									StringValue: `${this.resourceType}Task:${task.taskType}`,
								},
							},
						})
					)
				)
			);
		}
		await Promise.allSettled(sqsFutures);
		return task;
	}
}

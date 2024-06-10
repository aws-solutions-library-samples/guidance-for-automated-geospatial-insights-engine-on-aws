import { FastifyBaseLogger } from "fastify";
import ow from 'ow';
import { CommonRepository } from "../repository.common.js";
import { PkType } from "../../common/pkTypes.js";
import { SQSClient } from "@aws-sdk/client-sqs";
import { TaskService } from "../../common/tasks/service.js";
import { TaskRepository } from "../../common/tasks/repository.js";
import { CreateTaskRequestBody } from "../../common/tasks/schemas.js";

export class PolygonTaskService extends TaskService {
	public constructor(log: FastifyBaseLogger,
					   repository: TaskRepository,
					   commonRepository: CommonRepository,
					   batchSize: number,
					   sqsClient: SQSClient,
					   sqsQueueUrl: string,
					   concurrencyLimit: number) {
		super(log, repository, commonRepository, batchSize, sqsClient, sqsQueueUrl, concurrencyLimit, PkType.PolygonTask, 'Polygon');
	}

	public validate(createTaskRequestBody: CreateTaskRequestBody): void {
		this.log.debug(`PolygonTaskService> validate> in> createTaskRequestBody: ${JSON.stringify(createTaskRequestBody)}`);

		ow(createTaskRequestBody, ow.object.nonEmpty)
		ow(createTaskRequestBody.items, ow.array.nonEmpty)

		// loop over all activities
		for (let i = 0; i < createTaskRequestBody.items.length; i++) {
			const polygon = createTaskRequestBody.items[i];
			if (createTaskRequestBody.taskType === 'create') {
				ow(
					polygon,
					ow.object.exactShape({
						regionId: ow.string.nonEmpty,
						name: ow.string.nonEmpty,
						boundary: ow.array.nonEmpty,
						exclusions: ow.optional.array,
						attributes: ow.optional.object,
						tags: ow.optional.object,
					})
				);
			}

			if (createTaskRequestBody.taskType === 'update') {
				ow(
					polygon,
					ow.object.exactShape({
						id: ow.string.nonEmpty,
						name: ow.optional.string,
						boundary: ow.optional.array,
						exclusions: ow.optional.array,
						attributes: ow.optional.object,
						tags: ow.optional.object,
					})
				);
			}
		}

		this.log.debug(`PolygonTaskService> validate> exit`);
	}

}

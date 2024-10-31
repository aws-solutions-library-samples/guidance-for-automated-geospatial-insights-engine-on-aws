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

import { NotFoundError } from '@agie/resource-api-base';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { ListPaginationOptions, NextToken } from '../common/schemas.js';
import { SecurityContext } from '../common/scopes.js';
import { ExecutionTaskService } from '../tasks/service.js';
import { ExecutionTaskItemRepository } from './repository.js';
import { TaskItemResource } from './schemas.js';

export class ExecutionTaskItemService {
	public constructor(private readonly log: FastifyBaseLogger, private readonly repository: ExecutionTaskItemRepository, private readonly taskService: ExecutionTaskService) {}

	public async create(taskItem: TaskItemResource): Promise<void> {
		this.log.debug(`ExecutionTaskItemService> createBulk> start in:  taskItem: ${JSON.stringify(taskItem)}`);

		ow(
			taskItem,
			ow.object.partialShape({
				taskId: ow.string.nonEmpty,
				regionId: ow.string.nonEmpty,
				resultId: ow.string.nonEmpty,
				status: ow.string.oneOf(['success', 'failure']),
			})
		);

		await this.repository.create(taskItem);
		this.log.debug(`ExecutionTaskItemService> create> exit`);
	}

	public async get(securityContext: SecurityContext, taskId: string, startDateTime: string): Promise<TaskItemResource> {
		this.log.debug(`ExecutionTaskItemService> get> taskId:${taskId}, startDateTime:${startDateTime}`);

		ow(taskId, ow.string.nonEmpty);
		ow(startDateTime, ow.date);

		const taskItem = await this.repository.get(taskId, startDateTime);

		if (taskItem === undefined) {
			throw new NotFoundError(`Task Item '${startDateTime}' not found.`);
		}

		this.log.debug(`ExecutionTaskItemService> get> exit:${JSON.stringify(taskItem)}`);
		return taskItem;
	}

	public async list(securityContext: SecurityContext, taskId: string, options: ListPaginationOptions): Promise<[TaskItemResource[], NextToken]> {
		this.log.debug(`ExecutionTaskItemService> list> taskId:${taskId}, options: ${JSON.stringify(options)}`);
		ow(taskId, ow.string.nonEmpty);

		// This will throws exception if it does not exist
		await this.taskService.get(securityContext, taskId);

		const [taskItems, nextToken] = await this.repository.list(taskId, options);

		this.log.debug(`ExecutionTaskItemService> list> exit> taskItems: ${JSON.stringify(taskItems)}, options: ${JSON.stringify(options)}`);
		return [taskItems, nextToken];
	}
}

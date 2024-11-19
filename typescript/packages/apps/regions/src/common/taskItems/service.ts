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

import { SecurityContext } from '@agie/rest-api-authorizer';
import type { FastifyBaseLogger } from 'fastify';
import { NotFoundError } from '../../common/errors.js';
import type { TaskItemListOptions } from './repository.js';
import { TaskItemRepository } from './repository.js';
import { TaskItemResource } from './schemas.js';

export class TaskItemService {
	private readonly log: FastifyBaseLogger;
	private readonly repository: TaskItemRepository;

	public constructor(log: FastifyBaseLogger, repository: TaskItemRepository) {
		this.log = log;
		this.repository = repository;
	}

	public async createBulk(taskItems: TaskItemResource[]): Promise<void> {
		this.log.debug(`TaskItemService> createBulk> start in:  taskItem: ${JSON.stringify(taskItems)}`);

		await this.repository.create(taskItems);

		this.log.debug(`TaskItemService> create> exit`);
	}

	public async get(securityContext: SecurityContext, taskId: string, name: string): Promise<TaskItemResource> {
		this.log.debug(`TaskItemService> get> taskId:${taskId}, name:${name}`);

		const taskItem = await this.repository.get(taskId, name);
		if (taskItem === undefined) {
			throw new NotFoundError(`Task Item '${name}' not found.`);
		}

		this.log.debug(`TaskItemService> get> exit:${JSON.stringify(taskItem)}`);
		return taskItem;
	}

	public async list(securityContext: SecurityContext, taskId: string, options: TaskItemListOptions): Promise<[TaskItemResource[], string]> {
		this.log.debug(`TaskItemService> list> taskId: ${taskId} options: ${JSON.stringify(options)}`);

		// retrieve the task items
		let taskItems: TaskItemResource[] = [];
		let paginationKey: string;
		do {
			// retrieve a page of id
			[taskItems, paginationKey] = await this.repository.list(taskId, options);

			// we may have ended up with less than the requested page of results. if so, retrieve the next page
		} while (paginationKey !== undefined && taskItems.length < options.count);

		this.log.debug(`TaskItemService> list> exit:${JSON.stringify([taskItems, paginationKey])}`);
		return [taskItems, paginationKey];
	}
}

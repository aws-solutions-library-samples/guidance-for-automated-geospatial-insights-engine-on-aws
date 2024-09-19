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

import { EventPublisher } from '@agie/events';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { NotFoundError } from '../../common/errors.js';
import { SecurityContext } from '../../common/scopes.js';
import { ResultsRepository } from './repository.js';
import { CreateResult, Result, ResultId, ResultListOptions, UpdateResult } from './schemas.js';

export class ResultsService {
	public constructor(readonly log: FastifyBaseLogger, readonly resultsRepository: ResultsRepository, readonly eventPublisher: EventPublisher) {}

	public async list(securityContext: SecurityContext, regionId: string, options: ResultListOptions): Promise<[Result[], ResultId]> {
		this.log.debug(`ResultsService> list> regionId:${regionId}, options: ${options}`);
		if (options.token) {
			options.token = decodeURIComponent(options.token);
		}
		const [results, resultId] = await this.resultsRepository.list(regionId, options);
		this.log.debug(`ResultsService> list> regionId:${regionId}`);
		return [results, resultId];
	}

	public async get(securityContext: SecurityContext, regionId: string, resultId: string): Promise<Result> {
		this.log.debug(`ResultsService> list> regionId:${regionId}, resultId:${resultId}`);
		const result = await this.resultsRepository.get(regionId, resultId);

		if (result === undefined) {
			throw new NotFoundError(`Result '${resultId}' for region: ${regionId} not found.`);
		}

		this.log.debug(`ResultsService> list> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async update(params: UpdateResult): Promise<Result> {
		this.log.debug(`RegionService> update> params:${params}`);
		// Validation
		ow(params, ow.object.nonEmpty);
		ow(
			params,
			ow.object.exactShape({
				status: ow.string.nonEmpty,
				id: ow.string.nonEmpty,
				regionId: ow.string.nonEmpty,
				message: ow.optional.string,
			})
		);

		const existing = await this.resultsRepository.get(params.regionId, params.id);
		if (existing === undefined) {
			throw new NotFoundError(`Result '${params.id}' for Region '${params.regionId}' not found.`);
		}

		const updated: Result = {
			...existing,
			status: params.status,
			message: params.message,
			updatedAt: new Date().toISOString(),
		};
		// save
		await this.resultsRepository.put(updated);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'updated',
			id: updated.id,
			resourceType: 'Result',
			new: updated,
			old: existing,
		});

		// return
		this.log.debug(`RegionService> create> exit:${JSON.stringify(updated)}`);
		return updated;
	}

	public async create(params: CreateResult): Promise<Result> {
		this.log.debug(`RegionService> create> params:${params}`);

		// Validation
		ow(params, ow.object.nonEmpty);
		ow(
			params,
			ow.object.exactShape({
				status: ow.string.nonEmpty,
				id: ow.string.nonEmpty,
				regionId: ow.string.nonEmpty,
				engineType: ow.string.nonEmpty,
				scheduleDateTime: ow.string.nonEmpty,
				executionId: ow.optional.string,
				message: ow.optional.string,
			})
		);

		const saved: Result = {
			...params,
			createdAt: new Date().toISOString(),
		};
		// save
		await this.resultsRepository.put(saved);

		// publish the event
		await this.eventPublisher.publishEvent({
			eventType: 'created',
			id: saved.id,
			resourceType: 'Result',
			new: saved,
		});

		// return
		this.log.debug(`RegionService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}
}

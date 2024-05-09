import { FastifyBaseLogger } from "fastify";
import { ResultsRepository } from "./repository.js";
import { CreateResult, Result, ResultId, ResultListOptions, UpdateResult } from "./schemas.js";
import ow from 'ow';
import { SecurityContext } from "../../common/scopes.js";
import { NotFoundError } from "../../common/errors.js";

export class ResultsService {

	public constructor(
		readonly log: FastifyBaseLogger,
		readonly resultsRepository: ResultsRepository,
	) {
	}

	public async list(securityContext: SecurityContext, regionId: string, options: ResultListOptions): Promise<[Result[], ResultId]> {
		this.log.debug(`ResultsService> list> regionId:${regionId}, options: ${options}`);
		const [results, resultId] = await this.resultsRepository.list(regionId, options);
		this.log.debug(`ResultsService> list> regionId:${regionId}`);
		return [results, resultId]
	}

	public async get(securityContext: SecurityContext, regionId: string, resultId: string): Promise<Result> {
		this.log.debug(`ResultsService> list> regionId:${regionId}, resultId:${resultId}`);
		const result = await this.resultsRepository.get(regionId, resultId);
		this.log.debug(`ResultsService> list> regionId:${regionId}`);
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
			updatedAt: new Date().toISOString()
		}
		// save
		await this.resultsRepository.put(updated);
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
			createdAt: new Date().toISOString()
		}
		// save
		await this.resultsRepository.put(saved);

		// return
		this.log.debug(`RegionService> create> exit:${JSON.stringify(saved)}`);
		return saved;
	}
}
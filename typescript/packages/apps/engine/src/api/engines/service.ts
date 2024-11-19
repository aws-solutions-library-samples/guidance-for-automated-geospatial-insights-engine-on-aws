import { InvalidRequestError, NotFoundError } from '@agie/resource-api-base';
import { SecurityContext } from '@agie/rest-api-authorizer';
import { BatchClient, DeregisterJobDefinitionCommand, RegisterJobDefinitionCommand } from '@aws-sdk/client-batch';
import { GetRoleCommand, IAMClient } from '@aws-sdk/client-iam';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';
import { ulid } from 'ulid';
import { ListPaginationOptions } from '../../common/schemas.js';
import { RegistrationRepository } from '../registrations/repository.js';
import { EngineRepository } from './repository.js';
import { EngineNew, EngineResource, EngineUpdate } from './schemas.js';

export class EngineService {
	public constructor(
		private readonly log: FastifyBaseLogger,
		private readonly batch: BatchClient,
		private readonly iam: IAMClient,
		private readonly containerExecutionRoleArn: string,
		private readonly repository: EngineRepository,
		private readonly registrationRepository: RegistrationRepository
	) {}

	public async list(securityContext: SecurityContext, options: ListPaginationOptions) {
		this.log.debug(`EngineService> list> options: ${JSON.stringify(options)}`);

		ow(securityContext, ow.object.nonEmpty);
		ow(securityContext.sub, ow.string.nonEmpty);

		return await this.repository.list(options);
	}

	public async delete(securityContext: SecurityContext, id: string): Promise<void> {
		this.log.info(`EngineService> delete> in> id: ${id}`);
		ow(id, ow.string.nonEmpty);

		const engine = await this.get(securityContext, id);

		if (engine.createdBy == '@agie/cli') {
			throw new InvalidRequestError(`Cannot delete system created engine ${id}`);
		}

		const [registrations, _] = await this.registrationRepository.list(engine.id);

		if (registrations.length > 0) throw new InvalidRequestError(`Engine with id: ${id} has registrations. Please delete all registrations before deleting the engine.`);

		await this.batch.send(
			new DeregisterJobDefinitionCommand({
				jobDefinition: engine.jobDefinitionArn,
			})
		);

		await this.repository.delete(id);

		this.log.info(`EngineService> delete> exit`);
	}

	public async get(securityContext: SecurityContext, id: string): Promise<EngineResource> {
		this.log.info(`EngineService> get> in> id: ${id}`);

		ow(id, ow.string.nonEmpty);

		const engine = await this.repository.get(id);

		if (!engine) throw new NotFoundError(`Engine with id: ${id} not found.`);

		this.log.info(`EngineService> get> exit> engine: ${JSON.stringify(engine)}`);

		return engine;
	}

	public async update(securityContext: SecurityContext, id: string, request: EngineUpdate): Promise<EngineResource> {
		this.log.info(`EngineService> update> in> id: ${id}, request: ${JSON.stringify(request)}`);

		ow(id, ow.string.nonEmpty);
		ow(request, ow.object.nonEmpty);

		// Get existing engine
		const existingEngine = await this.get(securityContext, id);

		// Merge existing engine with update request
		const updatedEngine: EngineResource = {
			...existingEngine,
			image: request.image ?? existingEngine.image,
			jobRoleArn: request.jobRoleArn ?? existingEngine.jobRoleArn,
			environment: request.environment ?? existingEngine.environment,
			vcpus: request.vcpus ?? existingEngine.vcpus,
			memory: request.memory ?? existingEngine.memory,
		};

		await this.iam.send(new GetRoleCommand({ RoleName: updatedEngine?.jobRoleArn!.split('/')[1] }));

		// Deregister existing job definition
		await this.batch.send(
			new DeregisterJobDefinitionCommand({
				jobDefinition: existingEngine.jobDefinitionArn,
			})
		);

		// Register new job definition
		const registerJobResponse = await this.batch.send(this.assembleRegisterJobDefinitionCommand(updatedEngine));

		const engineResource = {
			...updatedEngine,
			jobDefinitionArn: registerJobResponse.jobDefinitionArn,
			updatedAt: new Date(Date.now()).toISOString(),
			UpdatedBy: securityContext.email,
		};

		await this.repository.create(engineResource);

		this.log.info(`EngineService> update> exit> engineResource: ${engineResource}`);

		return engineResource;
	}

	private assembleRegisterJobDefinitionCommand(updatedEngine: {
		name: string;
		jobRoleArn: string;
		image: string;
		memory: number;
		vcpus: number;
		environment: { [x: string]: string };
	}) {
		this.log.info(`EngineService> assembleRegisterJobDefinitionCommand> in> updatedEngine: ${JSON.stringify(updatedEngine)}`);

		return new RegisterJobDefinitionCommand({
			jobDefinitionName: updatedEngine.name,
			type: 'container',
			containerProperties: {
				image: updatedEngine.image,
				jobRoleArn: updatedEngine.jobRoleArn,
				executionRoleArn: this.containerExecutionRoleArn,
				environment: Object.entries(updatedEngine.environment).map(([k, v]) => ({ name: k, value: v })),
				networkConfiguration: {
					assignPublicIp: 'DISABLED',
				},
				resourceRequirements: [
					{
						type: 'MEMORY',
						value: updatedEngine.memory.toString(),
					},
					{
						type: 'VCPU',
						value: updatedEngine.vcpus.toString(),
					},
				],
			},
			timeout: {
				attemptDurationSeconds: 600,
			},
			platformCapabilities: ['FARGATE'],
			propagateTags: true,
		});
	}

	public async create(securityContext: SecurityContext, request: EngineNew): Promise<EngineResource> {
		this.log.info(`EngineService> create> in> request: ${JSON.stringify(request)}`);

		ow(request, ow.object.nonEmpty);
		ow(request.name, ow.string.nonEmpty);
		ow(request.jobRoleArn, ow.string.nonEmpty);
		ow(request.image, ow.string.nonEmpty);
		ow(request.vcpus, ow.number.greaterThan(0));
		ow(request.memory, ow.number.greaterThan(0));

		await this.iam.send(new GetRoleCommand({ RoleName: request?.jobRoleArn!.split('/')[1] }));

		const registerJobResponse = await this.batch.send(this.assembleRegisterJobDefinitionCommand(request));

		const engineResource = {
			...request,
			id: ulid().toLowerCase(),
			jobDefinitionArn: registerJobResponse.jobDefinitionArn,
			createdAt: new Date(Date.now()).toISOString(),
			createdBy: securityContext.email,
		};

		await this.repository.create(engineResource);

		this.log.info(`EngineService> create> exit> engineResource: ${engineResource}`);

		return engineResource;
	}
}

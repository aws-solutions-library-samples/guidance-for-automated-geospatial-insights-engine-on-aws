import type { StacServerClient } from '@arcade/clients';
import { CreateUserEvent } from '../lambda_stacserver_init.js';
import type { BaseLogger } from 'pino';
import ow from 'ow';

export class StacServerInitializer {
	constructor(private log: BaseLogger, private readonly stacServerClient: StacServerClient) {}

	public async processCreateRole(): Promise<void> {
		this.log.info(`StacServerInitializer > processCreateRole >in`);

		await this.stacServerClient.createOpenSearchRole();

		this.log.info(`StacServerInitializer > processCreateRole >exit`);
	}

	public async processCreateUser(event: any): Promise<void> {
		this.log.info(`StacServerInitializer > processCreateUser >in`);
		const payload: CreateUserEvent = JSON.parse(event);

		ow(payload, ow.object.nonEmpty);
		ow(payload.password, ow.string.nonEmpty);

		await this.stacServerClient.createOpenSearchUser(payload.password);

		this.log.info(`StacServerInitializer > processCreateUser >exit`);
	}

	public async processLineRoleToUser(): Promise<void> {
		this.log.info(`StacServerInitializer > processLineRoleToUser >in `);

		await this.stacServerClient.LinkRoleToUser();

		this.log.info(`StacServerInitializer > processLineRoleToUser >exit`);
	}
}

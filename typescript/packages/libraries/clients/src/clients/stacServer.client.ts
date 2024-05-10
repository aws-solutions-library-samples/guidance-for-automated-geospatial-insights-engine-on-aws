import type { Catalog, Collection, StacItem } from '@arcade/events';
import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import axios from 'axios';

export class StacServerClient extends ClientServiceBase {
	private readonly log: BaseLogger;
	private readonly snsClient: SNSClient;
	private readonly lambdaClient: LambdaClient;
	private readonly secretsManagerClient: SecretsManagerClient;
	private readonly stacServerIngestSnsTopicArn: string;
	private readonly stacServerApiFunctionName: string;
	private readonly stacServerOpenSearchEndpoint: string;
	private readonly openSearchMasterCredentials: string;

	constructor(
		log: BaseLogger,
		snsClient: SNSClient,
		lambdaClient: LambdaClient,
		secretsManagerClient: SecretsManagerClient,
		stacServerIngestSnsTopicArn: string,
		stacServerApiFunctionName: string,
		stacServerOpenSearchEndpoint: string,
		openSearchMasterCredentials: string
	) {
		super();
		this.log = log;
		this.snsClient = snsClient;
		this.stacServerIngestSnsTopicArn = stacServerIngestSnsTopicArn;
		this.lambdaClient = lambdaClient;
		this.secretsManagerClient = secretsManagerClient;
		this.stacServerApiFunctionName = stacServerApiFunctionName;
		this.stacServerOpenSearchEndpoint = stacServerOpenSearchEndpoint;
		this.openSearchMasterCredentials = openSearchMasterCredentials;
	}

	public async publishCatalog(req: Catalog): Promise<void> {
		this.log.trace(`StacServerClient > publishCatalog > in > request: ${JSON.stringify(req)}`);

		await this.snsClient.send(
			new PublishCommand({
				Message: JSON.stringify(req),
				TopicArn: this.stacServerIngestSnsTopicArn,
			})
		);

		this.log.trace(`StacServerClient > publishCatalog > exit`);
	}

	public async publishCollection(req: Collection): Promise<void> {
		this.log.trace(`StacServerClient > publishCollection > in > request: ${JSON.stringify(req)}`);

		await this.snsClient.send(
			new PublishCommand({
				Message: JSON.stringify(req),
				TopicArn: this.stacServerIngestSnsTopicArn,
			})
		);

		this.log.trace(`StacServerClient > publishCollection > exit`);
	}

	public async publishStacItem(req: StacItem): Promise<void> {
		this.log.trace(`StacServerClient > publishStacItem > in > request: ${JSON.stringify(req)}`);

		await this.snsClient.send(
			new PublishCommand({
				Message: JSON.stringify(req),
				TopicArn: this.stacServerIngestSnsTopicArn,
			})
		);

		this.log.trace(`StacServerClient > publishStacItem > exit`);
	}

	// TODO: Implement search functionality
	// Currently UI interacts directly with the stac server in the future we might need to proxy these requests
	public async search(req: unknown): Promise<void> {
		this.log.trace(`StacServerClient > search > in > $${JSON.stringify(req)} `);

		const input: InvokeCommandInput = {
			FunctionName: this.stacServerApiFunctionName,
			Payload: Buffer.from(JSON.stringify(req)),
		};

		const result = await this.lambdaClient.send(new InvokeCommand(input));
		const payload = JSON.parse(Buffer.from(result.Payload as Uint8Array).toString());

		this.log.trace(`StacServerClient > search > exit payload:${JSON.stringify(payload)}`);
		return payload;
	}

	public async createOpenSearchRole(): Promise<void> {
		this.log.trace(`StacServerClient >createOpenSearchRole > in`);
		//get the master credentials from secretsManager
		const masterCredentials = await this.secretsManagerClient.send(new GetSecretValueCommand({ SecretId: this.openSearchMasterCredentials }));
		const credentials = JSON.parse(masterCredentials.SecretString);

		const payload = {
			cluster_permissions: ['cluster_composite_ops', 'cluster:monitor/health'],
			index_permissions: [
				{
					index_patterns: ['*'],
					allowed_actions: ['indices_all'],
				},
			],
			tenant_permissions: [
				{
					tenant_patterns: ['global_tenant'],
					allowed_actions: ['kibana_all_read'],
				},
			],
		};
		await axios.put(`https://${this.stacServerOpenSearchEndpoint}/_plugins/_security/api/roles/stac_server_role` as string, payload, {
			headers: {
				'Content-Type': 'application/json',
			},
			auth: {
				username: credentials.username,
				password: credentials.password,
			},
		});
		this.log.trace(`StacServerClient >createOpenSearchRole > exit`);
	}

	public async createOpenSearchUser(password: string): Promise<void> {
		this.log.trace(`StacServerClient > createOpenSearchUser > in`);

		const masterCredentials = await this.secretsManagerClient.send(new GetSecretValueCommand({ SecretId: this.openSearchMasterCredentials }));
		const credentials = JSON.parse(masterCredentials.SecretString);
		const payload = { password };
		await axios.put(`https://${this.stacServerOpenSearchEndpoint}/_plugins/_security/api/internalusers/stac_server` as string, payload, {
			headers: {
				'Content-Type': 'application/json',
			},
			auth: {
				username: credentials.username,
				password: credentials.password,
			},
		});
		this.log.trace(`StacServerClient > createOpenSearchUser > exit`);
	}

	public async LinkRoleToUser(): Promise<void> {
		this.log.trace(`StacServerClient > LinkRoleToUser> in`);

		const masterCredentials = await this.secretsManagerClient.send(new GetSecretValueCommand({ SecretId: this.openSearchMasterCredentials }));
		const credentials = JSON.parse(masterCredentials.SecretString);

		const payload = { users: ['stac_server'] };
		await axios.put(`https://${this.stacServerOpenSearchEndpoint}/_plugins/_security/api/rolesmapping/stac_server_role` as string, payload, {
			headers: {
				'Content-Type': 'application/json',
			},
			auth: {
				username: credentials.username,
				password: credentials.password,
			},
		});
		this.log.trace(`StacServerClient > LinkRoleToUser> exit`);
	}
}

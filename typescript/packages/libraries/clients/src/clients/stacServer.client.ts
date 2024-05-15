import type { Catalog, Collection, ResourceType, StacItem } from '@arcade/events';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import axios from 'axios';
import ow from 'ow';

export class StacServerClient extends ClientServiceBase {
	constructor(
		readonly log: BaseLogger,
		readonly snsClient: SNSClient,
		readonly lambdaClient: LambdaClient,
		readonly stacServerIngestSnsTopicArn: string,
		readonly stacServerUrl: string,
		readonly secretsManagerClient: SecretsManagerClient,
		readonly stacServerOpenSearchEndpoint: string,
		readonly openSearchMasterCredentials: string
	) {
		super();
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

	public async getCollection(token: string, request: { id: string; type: ResourceType }): Promise<Collection> {
		this.log.trace(`StacServerClient > getCollection > in > request: ${JSON.stringify(JSON.stringify(request))} `);
		let result: Collection;

		ow(request, ow.object.nonEmpty);
		ow(request.type, ow.string.oneOf(['Group', 'Region']));
		ow(request.id, ow.string.nonEmpty);

		try {
			const collectionId = `${request.type.toLowerCase()}_${request.id}`;
			const response = await axios.get<Collection>(`${this.stacServerUrl}/collections/${collectionId}`, {
				headers: {
					'Authorization-Type': `Bearer ${token}`,
				},
			});
			result = response.data;
		} catch (err) {
			this.log.error(`StacServerClient> getCollection> error: ${JSON.stringify(err)}`);
		}

		this.log.trace(`StacServerClient > getCollection > exit payload:${JSON.stringify(result)}`);
		return result;
	}

	public async getCollectionItem(token: string, request: { id: string; collectionId: string; collectionType: ResourceType }): Promise<StacItem> {
		this.log.trace(`StacServerClient > getCollectionItem > in > request: ${JSON.stringify(request)} `);

		ow(request, ow.object.nonEmpty);
		ow(request.collectionType, ow.string.oneOf(['Group', 'Region']));
		ow(request.id, ow.string.nonEmpty);
		ow(request.collectionId, ow.string.nonEmpty);

		let result: StacItem;
		try {
			const collectionId = `${request.collectionType.toLowerCase()}_${request.id}`;
			const itemId = `${request.collectionId}_${request.id}`;
			const response = await axios.get<StacItem>(`${this.stacServerUrl}/collections/${collectionId}/items/${itemId}`, {
				headers: {
					'Authorization-Type': `Bearer ${token}`,
				},
			});
			result = response.data;
		} catch (err) {
			this.log.error(`StacServerClient> getCollectionItem> error: ${JSON.stringify(err)}`);
		}
		this.log.trace(`StacServerClient > getCollectionItem > exit payload:${JSON.stringify(result)}`);
		return result;
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

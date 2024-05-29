import type { Catalog, Collection, ResourceType, StacItem } from '@arcade/events';
import { SearchResult } from "@arcade/events";
import { LambdaClient } from '@aws-sdk/client-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import axios from 'axios';
import ow from 'ow';
import { SearchRequest } from "./stacServer.model.js";

export class StacServerClient extends ClientServiceBase {

	private stacApiKey: string;
	private credentials: { username: string, password: string }

	constructor(
		readonly log: BaseLogger,
		readonly snsClient: SNSClient,
		readonly lambdaClient: LambdaClient,
		readonly stacServerIngestSnsTopicArn: string,
		readonly stacServerUrl: string,
		readonly secretsManagerClient: SecretsManagerClient,
		readonly stacServerOpenSearchEndpoint: string,
		readonly stacOpenSearchSecretName: string,
		readonly stacApiKeySecretName: string
	) {
		super();
	}

	private async getApiKey(): Promise<string> {
		if (this.stacApiKey !== undefined) return this.stacApiKey;
		const secretResponse = await this.secretsManagerClient.send(new GetSecretValueCommand({ SecretId: this.stacApiKeySecretName }))
		const { apiKey } = JSON.parse(secretResponse.SecretString);
		this.stacApiKey = Buffer.from(apiKey, 'utf-8').toString('base64');
		return this.stacApiKey;
	}

	private async getOpenSearchCredentials(): Promise<{ username: string, password: string }> {
		if (this.credentials !== undefined) return this.credentials
		const masterCredentials = await this.secretsManagerClient.send(new GetSecretValueCommand({ SecretId: this.stacOpenSearchSecretName }));
		this.credentials = JSON.parse(masterCredentials.SecretString);
		return this.credentials;
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

	public async search(request: SearchRequest): Promise<SearchResult> {
		this.log.trace(`StacServerClient > getCollection > in > request: ${JSON.stringify(JSON.stringify(request))} `);
		let result: SearchResult;
		ow(request, ow.object.nonEmpty);
		ow(request.bbox, ow.array.nonEmpty);
		try {
			const token = await this.getApiKey();
			const response = await axios.post<SearchResult>(`${this.stacServerUrl}/search`,
				request,
				{
					headers: {
						'X-API-KEY': `${token}`,
					}
				});
			result = response.data;
		} catch (err) {
			this.log.error(`StacServerClient> getCollection> error: ${JSON.stringify(err)}`);
		}

		this.log.trace(`StacServerClient > getCollection > exit payload:${JSON.stringify(result)}`);
		return result;
	}

	public async getCollection(request: {
		id: string;
		type: ResourceType
	}): Promise<Collection> {
		this.log.trace(`StacServerClient > getCollection > in > request: ${JSON.stringify(JSON.stringify(request))} `);
		let result: Collection;
		ow(request, ow.object.nonEmpty);
		ow(request.type, ow.string.oneOf(['Group', 'Region']));
		ow(request.id, ow.string.nonEmpty);
		try {
			const token = await this.getApiKey();
			const collectionId = `${request.type.toLowerCase()}_${request.id}`;
			const response = await axios.get<Collection>(`${this.stacServerUrl}/collections/${collectionId}`, {
				headers: {
					'X-API-KEY': `${token}`,
				},
			});
			result = response.data;
		} catch (err) {
			this.log.error(`StacServerClient> getCollection> error: ${JSON.stringify(err)}`);
		}

		this.log.trace(`StacServerClient > getCollection > exit payload:${JSON.stringify(result)}`);
		return result;
	}

	public async getCollectionItem(request: {
		id: string;
		collectionId: string;
		collectionType: ResourceType
	}): Promise<StacItem> {
		this.log.trace(`StacServerClient > getCollectionItem > in > request: ${JSON.stringify(request)} `);

		ow(request, ow.object.nonEmpty);
		ow(request.collectionType, ow.string.oneOf(['Group', 'Region']));
		ow(request.id, ow.string.nonEmpty);
		ow(request.collectionId, ow.string.nonEmpty);

		let result: StacItem;
		try {
			const token = await this.getApiKey();
			const collectionId = `${request.collectionType.toLowerCase()}_${request.id}`;
			const itemId = `${request.collectionId}_${request.id}`;
			const response = await axios.get<StacItem>(`${this.stacServerUrl}/collections/${collectionId}/items/${itemId}`, {
				headers: {
					'X-API-KEY': `${token}`,
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
		const credentials = await this.getOpenSearchCredentials();
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
		const credentials = await this.getOpenSearchCredentials();
		await axios.put(`https://${this.stacServerOpenSearchEndpoint}/_plugins/_security/api/internalusers/stac_server` as string, { password: credentials.password }, {
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
		const credentials = await this.getOpenSearchCredentials();
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

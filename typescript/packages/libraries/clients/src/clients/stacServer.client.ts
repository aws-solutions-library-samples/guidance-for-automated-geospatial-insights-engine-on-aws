import type { Catalog, Collection, ResourceType, StacItem } from '@arcade/events';
import { SearchResult } from "@arcade/events";
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import axios from 'axios';
import ow from 'ow';
import { SearchRequest } from "./stacServer.model.js";
import { aws4Interceptor } from "aws4-axios";


export class StacServerClient extends ClientServiceBase {
	constructor(
		readonly log: BaseLogger,
		readonly snsClient: SNSClient,
		readonly stacServerIngestSnsTopicArn: string,
		readonly stacServerUrl: string,
		readonly region: string
	) {
		const interceptor = aws4Interceptor({
			options: {
				region,
				service: "execute-api",
			},
		});
		axios.interceptors.request.use(interceptor as any);
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

	public async search(request: SearchRequest): Promise<SearchResult> {
		this.log.trace(`StacServerClient > getCollection > in > request: ${JSON.stringify(JSON.stringify(request))} `);
		let result: SearchResult;
		ow(request, ow.object.nonEmpty);
		ow(request.bbox, ow.array.nonEmpty);
		try {
			const response = await axios.post<SearchResult>(`${this.stacServerUrl}/search`,
				request);
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
			const collectionId = `${request.type.toLowerCase()}_${request.id}`;
			const response = await axios.get<Collection>(`${this.stacServerUrl}/collections/${collectionId}`);
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
			const collectionId = `${request.collectionType.toLowerCase()}_${request.id}`;
			const itemId = `${request.collectionId}_${request.id}`;
			const response = await axios.get<StacItem>(`${this.stacServerUrl}/collections/${collectionId}/items/${itemId}`);
			result = response.data;
		} catch (err) {
			this.log.error(`StacServerClient> getCollectionItem> error: ${JSON.stringify(err)}`);
		}
		this.log.trace(`StacServerClient > getCollectionItem > exit payload:${JSON.stringify(result)}`);
		return result;
	}
}

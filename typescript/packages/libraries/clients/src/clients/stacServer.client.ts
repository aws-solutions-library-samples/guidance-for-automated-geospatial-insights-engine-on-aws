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

import type { Catalog, Collection, StacItem } from '@agie/events';
import { SearchResult } from '@agie/events';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import axios from 'axios';
import ow from 'ow';
import { SearchRequest } from './stacServer.model.js';
import { aws4Interceptor } from 'aws4-axios';


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
				service: 'execute-api'
			}
		});
		axios.interceptors.request.use(interceptor as any);
		super();
	}

	public async publishCatalog(req: Catalog): Promise<void> {
		this.log.trace(`StacServerClient > publishCatalog > in > request: ${JSON.stringify(req)}`);
		await this.snsClient.send(
			new PublishCommand({
				Message: JSON.stringify(req),
				TopicArn: this.stacServerIngestSnsTopicArn
			})
		);
		this.log.trace(`StacServerClient > publishCatalog > exit`);
	}

	public async publishCollection(req: Collection): Promise<void> {
		this.log.trace(`StacServerClient > publishCollection > in > request: ${JSON.stringify(req)}`);
		await this.snsClient.send(
			new PublishCommand({
				Message: JSON.stringify(req),
				TopicArn: this.stacServerIngestSnsTopicArn
			})
		);
		this.log.trace(`StacServerClient > publishCollection > exit`);
	}

	public async publishStacItem(req: StacItem): Promise<void> {
		this.log.trace(`StacServerClient > publishStacItem > in > request: ${JSON.stringify(req)}`);

		await this.snsClient.send(
			new PublishCommand({
				Message: JSON.stringify(req),
				TopicArn: this.stacServerIngestSnsTopicArn
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
	}): Promise<Collection> {
		this.log.trace(`StacServerClient > getCollection > in > request: ${JSON.stringify(JSON.stringify(request))} `);
		let result: Collection;
		ow(request, ow.object.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		try {
			const response = await axios.get<Collection>(`${this.stacServerUrl}/collections/${request.id}`);
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
	}): Promise<StacItem> {
		this.log.trace(`StacServerClient > getCollectionItem > in > request: ${JSON.stringify(request)} `);

		ow(request, ow.object.nonEmpty);
		ow(request.collectionId, ow.string.nonEmpty);
		ow(request.id, ow.string.nonEmpty);

		const { collectionId, id } = request;

		let result: StacItem;
		try {
			const response = await axios.get<StacItem>(`${this.stacServerUrl}/collections/${collectionId}/items/${id}`);
			result = response.data;
		} catch (err) {
			this.log.error(`StacServerClient> getCollectionItem> error: ${JSON.stringify(err)}`);
		}
		this.log.trace(`StacServerClient > getCollectionItem > exit payload:${JSON.stringify(result)}`);
		return result;
	}
}

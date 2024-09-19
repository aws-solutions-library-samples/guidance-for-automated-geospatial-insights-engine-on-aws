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

import { Invoker, LambdaApiGatewayEventBuilder } from '@agie/lambda-invoker';
import { State } from '@aws-sdk/client-lambda';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import { LambdaRequestContext } from '../common/models.js';
import { Group, GroupListResources, ListPolygonsOptions, Polygon, PolygonListResource, Region, UpdateRegionParams } from './regions.models.js';

export class RegionsClient extends ClientServiceBase {
	private readonly log: BaseLogger;
	private readonly regionsApiFunctionName: string;
	private readonly lambdaInvoker: Invoker;

	constructor(log: BaseLogger, lambdaInvoker: Invoker, regionsApiFunctionName: string) {
		super();
		this.log = log;
		this.lambdaInvoker = lambdaInvoker;
		this.regionsApiFunctionName = regionsApiFunctionName;
	}

	public async listGroups(requestContext: LambdaRequestContext): Promise<GroupListResources | undefined> {
		this.log.trace(`RegionsClient> listGroups> in:`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/groups`);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as GroupListResources;
		this.log.trace(`RegionsClient> getGroupById> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async getGroupById(id: string, requestContext: LambdaRequestContext): Promise<Group | undefined> {
		this.log.trace(`RegionsClient> getGroupById> in: id:${id}}`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/groups/${id}`);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as Group;
		this.log.trace(`RegionsClient> getGroupById> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async updateRegion(id: string, updateRegionParams: UpdateRegionParams, requestContext: LambdaRequestContext): Promise<Region> {
		this.log.trace(`RegionsClient> updateRegion> in: updateRegionParams:${updateRegionParams}}`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('PATCH')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setBody(updateRegionParams)
			.setPath(`/regions/${id}`);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as Region;
		this.log.trace(`RegionsClient> updateRegion> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async getRegionById(id: string, requestContext?: LambdaRequestContext): Promise<Region | undefined> {
		this.log.trace(`RegionsClient> getRegionById> in: id:${id}}`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/regions/${id}`);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as Region;
		this.log.trace(`RegionsClient> getRegionById> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async listPolygons(options: ListPolygonsOptions | undefined, requestContext: LambdaRequestContext): Promise<PolygonListResource | undefined> {
		this.log.trace(`RegionsClient> listPolygons> in: options:${options}}`);

		const additionalHeaders = {};

		const { tags, ...rest } = options;

		const queryStrings = [];

		if (tags)
			queryStrings.push(
				...tags.map((t) => {
					`tags=${t}`;
				})
			);

		if (rest) queryStrings.push(...Object.entries(rest).map(([key, value]) => `${key}=${value}`));

		const path = queryStrings.length > 0 ? `/polygons?${queryStrings.join('&')}` : `/polygons`;

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(path);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as PolygonListResource;
		this.log.trace(`RegionsClient> listPolygons> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async getPolygonById(id: string, requestContext: LambdaRequestContext): Promise<Polygon | undefined> {
		this.log.trace(`RegionsClient> getPolygonById> in: id:${id}}`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/polygons/${id}`);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as Polygon;
		this.log.trace(`RegionsClient> getPolygonById> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async getStateById(id: string, requestContext?: LambdaRequestContext): Promise<State | undefined> {
		this.log.trace(`RegionsClient> getStateById> in: id:${id}}`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/states/${id}`);


		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as State;
		this.log.trace(`RegionsClient> getStateById> exit> result: ${JSON.stringify(result)}`);
		return result;
	}
}

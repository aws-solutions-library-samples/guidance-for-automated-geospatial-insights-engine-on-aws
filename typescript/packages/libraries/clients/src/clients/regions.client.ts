import { Invoker, LambdaApiGatewayEventBuilder } from '@arcade/lambda-invoker';
import { State } from '@aws-sdk/client-lambda';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import { LambdaRequestContext } from '../common/models.js';
import { Group, ListPolygonsOptions, Polygon, PolygonListResource, Region } from './regions.models.js';

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

	public async getGroupById(id: string, requestContext?: LambdaRequestContext): Promise<Group | undefined> {
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

	public async listPolygons(options?: ListPolygonsOptions, requestContext?: LambdaRequestContext): Promise<PolygonListResource | undefined> {
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

	public async getPolygonById(id: string, requestContext?: LambdaRequestContext): Promise<Polygon | undefined> {
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

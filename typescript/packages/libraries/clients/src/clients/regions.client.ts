import { Invoker, LambdaApiGatewayEventBuilder } from '@arcade/lambda-invoker';
import { State } from '@aws-sdk/client-lambda';
import type { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import { LambdaRequestContext } from '../common/models.js';
import { Group, ListZonesOptions, Region, Zone, ZoneListResource } from './regions.models.js';

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

	public async listZones(options?: ListZonesOptions, requestContext?: LambdaRequestContext): Promise<ZoneListResource | undefined> {
		this.log.trace(`RegionsClient> listZones> in: options:${options}}`);

		const additionalHeaders = {};

		const { tags, ...rest } = options;

		const queryStrings = [];

		if (tags) queryStrings.push(...tags.map(t => {`tags=${t}`}))

		if (rest) queryStrings.push(...Object.entries(rest).map(([key, value]) => `${key}=${value}`))

		const path = queryStrings.length > 0 ? `/zones?${queryStrings.join('&')}` : `/zones`

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(path);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as ZoneListResource;
		this.log.trace(`RegionsClient> listZones> exit> result: ${JSON.stringify(result)}`);
		return result;
	}

	public async getZoneById(id: string, requestContext?: LambdaRequestContext): Promise<Zone | undefined> {
		this.log.trace(`RegionsClient> getZoneById> in: id:${id}}`);
		const additionalHeaders = {};

		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/zones/${id}`);

		const result = (await this.lambdaInvoker.invoke(this.regionsApiFunctionName, event))?.body as Zone;
		this.log.trace(`RegionsClient> getZoneById> exit> result: ${JSON.stringify(result)}`);
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

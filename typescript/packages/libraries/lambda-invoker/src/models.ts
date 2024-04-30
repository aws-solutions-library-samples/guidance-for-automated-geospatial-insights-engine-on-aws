import { toUtf8 } from '@aws-sdk/util-utf8-node';
export interface LambdaApiGatewayEvent {
	resource: string;
	path?: string;
	httpMethod?: LambdaApiGatewayEventMethodTypes;
	headers?: Dictionary;
	multiValueHeaders?: { [key: string]: string[] };
	queryStringParameters?: Dictionary;
	multiValueQueryStringParameters?: { [key: string]: string[] };
	pathParameters?: Dictionary;
	stageVariables?: Dictionary;
	requestContext?: unknown;
	body?: string;
	isBase64Encoded?: boolean;
}

export class LambdaApiGatewayEventBuilder implements LambdaApiGatewayEvent {
	resource: string;
	path?: string;
	httpMethod?: LambdaApiGatewayEventMethodTypes;
	headers?: Dictionary;
	multiValueHeaders?: { [key: string]: string[] };
	queryStringParameters?: Dictionary;
	multiValueQueryStringParameters?: { [key: string]: string[] };
	pathParameters?: Dictionary;
	stageVariables?: Dictionary;
	requestContext?: unknown;
	body?: string;
	isBase64Encoded?: boolean;

	constructor() {
		this.resource = '/{proxy+}';
		return this;
	}

	public setHeaders(headers: Dictionary) {
		this.headers = headers;
		return this;
	}

	public setQueryStringParameters(value: Dictionary) {
		this.queryStringParameters = value;
		return this;
	}

	public setRequestContext(value: unknown) {
		this.requestContext = value;
		return this;
	}

	public setMultiValueQueryStringParameters(value: DictionaryArray) {
		this.multiValueQueryStringParameters = value;
		return this;
	}

	public setBody(body: any) {
		this.body = JSON.stringify(body);
		return this;
	}

	public setMethod(method: LambdaApiGatewayEventMethodTypes) {
		this.httpMethod = method;
		return this;
	}

	public setPath(path: string) {
		this.path = path;
		this.pathParameters = {
			path,
		};
		return this;
	}
}

export type LambdaApiGatewayEventMethodTypes = 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH';

export interface ApiGatewayInvokeResponsePayload {
	statusCode?: number;
	body?: unknown;
	headers?: Dictionary;
}

export class LambdaApiGatewayEventResponse implements ApiGatewayInvokeResponsePayload {
	public statusCode?: number;
	public body?: unknown;
	public headers?: Dictionary;

	constructor(payload?: Uint8Array) {
		if (payload === undefined) {
			return;
		}
		const parsedPayload: Payload = JSON.parse(toUtf8(payload));
		this.statusCode = parsedPayload?.statusCode;
		try {
			this.body = JSON.parse(parsedPayload?.body);
		} catch (error) {
			if (error instanceof SyntaxError) {
				// silently ignore as not all successful requests, such as a 204, return a json body
			} else {
				throw error;
			}
		}
		this.headers = parsedPayload?.headers;
	}
}

interface Payload {
	statusCode?: number;
	body?: string;
	headers?: Dictionary;
}

export class Dictionary {
	[key: string]: string;
}
export class DictionaryArray {
	[key: string]: string[];
}

import createHttpError from 'http-errors';
import type { BaseLogger } from 'pino';

import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda';
import { fromUtf8 } from '@aws-sdk/util-utf8-node';

import { LambdaApiGatewayEvent, LambdaApiGatewayEventResponse } from './models.js';

export class Invoker {
	private readonly log: BaseLogger;
	private readonly client: LambdaClient;

	public constructor(log: BaseLogger, client: LambdaClient) {
		this.log = log;
		this.client = client;
	}

	public async invoke(functionName: string, event: LambdaApiGatewayEvent): Promise<LambdaApiGatewayEventResponse> {
		this.log.debug(`Invoker> invoke> in> functionName:${functionName}, event:${JSON.stringify(event)}`);

		const params: InvokeCommandInput = {
			FunctionName: functionName,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify(event)),
		};

		const response = await this.client.send(new InvokeCommand(params));
		this.log.debug(`Invoker> invoke> response statusCode: ${response.StatusCode}`);

		const statusCode = response.StatusCode ?? -1;
		this.log.debug(`Invoker> invoke> response statusCode: ${statusCode}`);
		if (statusCode >= 200 && statusCode < 300) {
			const payload = new LambdaApiGatewayEventResponse(response.Payload);
			this.log.debug(`Invoker> invoke> response payload: ${JSON.stringify(payload)}`);

			if ((response.FunctionError?.length ?? 0) > 0) {
				const error = createHttpError(500);
				error['response'] = payload;
				throw error;
			}

			if (payload.statusCode >= 300) {
				const error = createHttpError(payload.statusCode);
				error.status = payload.statusCode;
				error.message = payload.body?.['message'];
				error['response'] = payload;
				throw error;
			}
			return payload;
		} else {
			const error = createHttpError(statusCode);
			error.status = statusCode;
			throw error;
		}
	}
}

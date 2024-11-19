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
import { BaseLogger } from 'pino';
import { ClientServiceBase } from '../common/common.js';
import { LambdaRequestContext } from '../common/models.js';
import { EngineResource } from './engines.models.js';

export class EnginesClient extends ClientServiceBase {
	private readonly log: BaseLogger;
	private readonly enginesApiFunctionName: string;
	private readonly lambdaInvoker: Invoker;

	constructor(log: BaseLogger, lambdaInvoker: Invoker, enginesApiFunctionName: string) {
		super();
		this.log = log;
		this.lambdaInvoker = lambdaInvoker;
		this.enginesApiFunctionName = enginesApiFunctionName;
	}

	public async get(engineId: string, requestContext?: LambdaRequestContext): Promise<EngineResource | undefined> {
		this.log.trace(`EnginesClient> get> in: engineId:${engineId}}`);
		const additionalHeaders = {};
		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setPath(`/engines/${engineId}`);
		const result = (await this.lambdaInvoker.invoke(this.enginesApiFunctionName, event))?.body as EngineResource;
		this.log.trace(`EnginesClient> get> exit> result: ${JSON.stringify(result)}`);
		return result;
	}
}

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

import { ClientServiceBase } from "../common/common.js";
import { BaseLogger } from "pino";
import { Invoker, LambdaApiGatewayEventBuilder } from "@agie/lambda-invoker";
import { LambdaRequestContext } from "../common/models.js";
import { ListResultsOptions, ResultListResource } from "./results.models.js";

export class ResultsClient extends ClientServiceBase {
	private readonly log: BaseLogger;
	private readonly resultsApiFunctionName: string;
	private readonly lambdaInvoker: Invoker;

	constructor(log: BaseLogger, lambdaInvoker: Invoker, resultsApiFunctionName: string) {
		super();
		this.log = log;
		this.lambdaInvoker = lambdaInvoker;
		this.resultsApiFunctionName = resultsApiFunctionName;
	}

	public async listResults(regionId: string, options?: ListResultsOptions, requestContext?: LambdaRequestContext): Promise<ResultListResource | undefined> {
		this.log.trace(`ResultsClient> listResults> in: options:${options}}`);
		const additionalHeaders = {};
		const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder()
			.setMethod('GET')
			.setHeaders(super.buildHeaders(additionalHeaders))
			.setRequestContext(requestContext)
			.setQueryStringParameters(options as Record<string, string>)
			.setPath(`/regions/${regionId}/results`);
		const result = (await this.lambdaInvoker.invoke(this.resultsApiFunctionName, event))?.body as ResultListResource;
		this.log.trace(`ResultsClient> listResults> exit> result: ${JSON.stringify(result)}`);
		return result;
	}


}

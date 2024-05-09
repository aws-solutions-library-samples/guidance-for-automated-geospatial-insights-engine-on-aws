import { ClientServiceBase } from "../common/common.js";
import { BaseLogger } from "pino";
import { Invoker, LambdaApiGatewayEventBuilder } from "@arcade/lambda-invoker";
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

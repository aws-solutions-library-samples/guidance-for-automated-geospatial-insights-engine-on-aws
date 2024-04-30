import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { ClientServiceBase } from '../common/common.js';
import type { BaseLogger } from 'pino';
import type { Collection, StacItem } from '@arcade/events';

export class StacServerClient extends ClientServiceBase {
	private readonly log: BaseLogger;
	private readonly snsClient: SNSClient
	private readonly lambdaClient: LambdaClient;
	private readonly stacServerIngestSnsTopicArn: string;
	private readonly stacServerApiFunctionName: string;

	constructor(log: BaseLogger, snsClient: SNSClient, lambdaClient: LambdaClient, stacServerIngestSnsTopicArn: string, stacServerApiFunctionName: string) {
		super();
		this.log = log;
		this.snsClient = snsClient;
		this.stacServerIngestSnsTopicArn = stacServerIngestSnsTopicArn;
		this.lambdaClient = lambdaClient;
		this.stacServerApiFunctionName = stacServerApiFunctionName;

	}

	public async publishCollection(req: Collection): Promise<void> {
		this.log.trace(`StacServerClient > publishCollection > in > request: ${JSON.stringify(req)}`);

		await this.snsClient.send(new PublishCommand({
			Message: JSON.stringify(req),
			TopicArn: this.stacServerIngestSnsTopicArn
		}));

		this.log.trace(`StacServerClient > publishCollection > exit`);
	}

	public async publishStacItem(req: StacItem): Promise<void> {
		this.log.trace(`StacServerClient > publishStacItem > in > request: ${JSON.stringify(req)}`);

		await this.snsClient.send(new PublishCommand({
			Message: JSON.stringify(req),
			TopicArn: this.stacServerIngestSnsTopicArn
		}));

		this.log.trace(`StacServerClient > publishStacItem > exit`);
	}

	// TODO: Implement search functionality
	// Currently UI interacts directly with the stac server in the future we might need to proxy these requests
	public async search(req: unknown): Promise<void> {
		this.log.trace(`StacServerClient > search > in > $${JSON.stringify(req)} `);

		const input: InvokeCommandInput = {
			FunctionName: this.stacServerApiFunctionName,
			Payload: Buffer.from(JSON.stringify(req)),

		};

		const result = await this.lambdaClient.send(new InvokeCommand(input));
		const payload = JSON.parse(Buffer.from(result.Payload as Uint8Array).toString());

		this.log.trace(`StacServerClient > search > exit payload:${JSON.stringify(payload)}`);
		return payload;

	}

}

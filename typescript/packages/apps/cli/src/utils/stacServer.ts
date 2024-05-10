import { getEventBridgeClient, getLambdaClient } from './awsClient.js';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { fromUtf8 } from '@aws-sdk/util-utf8-node';
import { LambdaApiGatewayEventBuilder } from '@arcade/lambda-invoker';
import { PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { CLI_EVENT_SOURCE, CLI_CATALOG_CREATE_EVENT } from '@arcade/events';

import config from './config.js';

const enableCollectionIndex = async (roleArn?: string): Promise<void> => {
	const lambdaClient = await getLambdaClient(roleArn);
	const functionName = await config.get('stacServerIngestionLambdaFunctionName');
	await lambdaClient.send(
		new InvokeCommand({
			FunctionName: functionName,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify({ create_indices: true })),
		}),
	);
};

const createOpenSearchRole = async (roleArn?: string): Promise<void> => {
	const lambdaClient = await getLambdaClient(roleArn);
	const functionName = await config.get('stacServerInitializerLambdaFunctionName');
	const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder().setMethod('POST').setPath(`/roles`);

	const results = await lambdaClient.send(
		new InvokeCommand({
			FunctionName: functionName,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify(event)),
		}),
	);
};

const createOpenSearchUser = async (password: string, roleArn?: string): Promise<void> => {
	const lambdaClient = await getLambdaClient(roleArn);
	const functionName = await config.get('stacServerInitializerLambdaFunctionName');
	const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder().setMethod('POST').setPath(`/users`).setBody({ password });

	const results = await lambdaClient.send(
		new InvokeCommand({
			FunctionName: functionName,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify(event)),
		}),
	);
};

const linkOpenSearchUserToRole = async (roleArn?: string): Promise<void> => {
	const lambdaClient = await getLambdaClient(roleArn);
	const functionName = await config.get('stacServerInitializerLambdaFunctionName');
	const event: LambdaApiGatewayEventBuilder = new LambdaApiGatewayEventBuilder().setMethod('POST').setPath(`/users/roles`);

	const results = await lambdaClient.send(
		new InvokeCommand({
			FunctionName: functionName,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify(event)),
		}),
	);
};

const createStacServerCatalog = async (roleArn?: string): Promise<void> => {
	const eventBridgeClient = await getEventBridgeClient(roleArn);
	const eventBridgeName = await config.get('stacServerInitializerLambdaFunctionName');

	const event: PutEventsRequestEntry = {
		EventBusName: eventBridgeName,

		DetailType: CLI_CATALOG_CREATE_EVENT,
		Source: CLI_EVENT_SOURCE,
		Time: new Date(),
		Detail: JSON.stringify({
			id: `catalog_arcade`,
			title: 'ARCADE Catalog',
			description: 'Default Catalog for ARCADE',
		}),
	};
	await eventBridgeClient.send(new PutEventsCommand({ Entries: [event] }));
};

export { enableCollectionIndex, createOpenSearchRole, createOpenSearchUser, linkOpenSearchUserToRole, createStacServerCatalog };

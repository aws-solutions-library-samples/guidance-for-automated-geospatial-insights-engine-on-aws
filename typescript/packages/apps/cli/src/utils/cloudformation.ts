import { DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { getCloudFormationClient } from './awsClient.js';

export interface StacServerMetadata {
	apiLambdaFunctionName: string;
	ingestionLambdaFunctionName: string;
	ingestionTopicArn: string;
	openSearchEndPoint: string;
}

export interface StackMetadata {
	name?: string;
	status?: string;
}

const getDeployedStacServerMetaData = async (environment: string, roleArn?: string): Promise<StacServerMetadata | undefined> => {
	const stackName = `stac-server-${environment}`;
	let response = undefined;
	const cfClient = await getCloudFormationClient(roleArn);
	const result = await cfClient.send(new DescribeStacksCommand({ StackName: stackName }));

	// Check if the stack exists and extract the necessary info
	if (result.Stacks.length > 0 && ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'].includes(result.Stacks[0].StackStatus)) {
		const apiLambdaFunctionArn = result.Stacks[0].Outputs.find((output) => {
			if (output.OutputKey == 'ApiLambdaFunctionQualifiedArn') return output;
		}).OutputValue;
		const apiLambdaFunctionName = apiLambdaFunctionArn.split(':')[6];
		const region = apiLambdaFunctionArn.split(':')[3];
		const accountId = apiLambdaFunctionArn.split(':')[4];

		const ingestionLambdaFunctionName = result.Stacks[0].Outputs.find((output) => {
			if (output.OutputKey == 'IngestLambdaFunctionQualifiedArn') return output;
		}).OutputValue.split(':')[6];

		const ingestionTopicArn = `arn:aws:sns:${region}:${accountId}:stac-server-${environment}-ingest`;

		const openSearchEndPoint = result.Stacks[0].Outputs.find((output) => {
			if (output.OutputKey == 'OpenSearchEndpoint') return output;
		}).OutputValue;

		response = {
			apiLambdaFunctionName,
			ingestionLambdaFunctionName,
			ingestionTopicArn,
			openSearchEndPoint,
		};
	}
	return response;
};

const getDeployedStackByName = async (stackName: string, roleArn?: string): Promise<StackMetadata> => {
	const cfClient = await getCloudFormationClient(roleArn);
	const result = await cfClient.send(new DescribeStacksCommand({ StackName: stackName })).then(async (r) => {
		const stackName = r.Stacks?.[0].StackName;
		const stackStatus = r.Stacks?.[0].StackStatus;
		return { name: stackName, status: stackStatus };
	});
	return result;
};

export { getDeployedStacServerMetaData, getDeployedStackByName };

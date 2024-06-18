import { DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { getCloudFormationClient } from './awsClient.js';

export interface StackMetadata {
	name?: string;
	status?: string;
}

const getDeployedStackByName = async (stackName: string, roleArn?: string): Promise<StackMetadata> => {
	const cfClient = await getCloudFormationClient(roleArn);
	return await cfClient.send(new DescribeStacksCommand({ StackName: stackName })).then(async (r) => {
		const stackName = r.Stacks?.[0].StackName;
		const stackStatus = r.Stacks?.[0].StackStatus;
		return { name: stackName, status: stackStatus };
	});
};

export { getDeployedStackByName };

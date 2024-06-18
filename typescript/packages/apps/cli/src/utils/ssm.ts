import { GetParameterCommand } from "@aws-sdk/client-ssm";
import { getSSMClient } from "./awsClient.js";

async function getParameterValue(path: string, roleArn?: string): Promise<string> {
	const ssm = await getSSMClient(roleArn);
	const response = await ssm.send(
		new GetParameterCommand({
			Name: path,
		})
	);
	return response.Parameter?.Value as string;
}

export { getParameterValue };

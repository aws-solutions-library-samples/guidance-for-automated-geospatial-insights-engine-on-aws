import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export async function getParameter(path: string): Promise<string> {
	const ssm = new SSMClient({});
	const response = await ssm.send(
		new GetParameterCommand({
			Name: path,
		})
	);
	return response.Parameter?.Value as string;
}

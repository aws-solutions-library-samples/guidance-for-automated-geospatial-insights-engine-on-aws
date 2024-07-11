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

import { CloudFormationClient, CloudFormationClientConfig } from '@aws-sdk/client-cloudformation';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { ulid } from 'ulid';
import { SSMClient, SSMClientConfig } from "@aws-sdk/client-ssm";

const stsClient = new STSClient({ region: process.env.ARCADE_REGION ?? process.env.AWS_REGION });

async function getSSMClient(roleArn?: string): Promise<SSMClient> {
	const clientConfig: SSMClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let ssmClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);
		ssmClient = new SSMClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		ssmClient = new SSMClient({
			...clientConfig,
		});
	}
	return ssmClient;
}

async function getCloudFormationClient(roleArn?: string): Promise<CloudFormationClient> {
	const clientConfig: CloudFormationClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let cfClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);

		cfClient = new CloudFormationClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		cfClient = new CloudFormationClient({
			...clientConfig,
		});
	}
	return cfClient;
}

export { getCloudFormationClient, getSSMClient };

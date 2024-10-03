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

import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { EC2Client } from '@aws-sdk/client-ec2';
import { OpenSearchClient } from '@aws-sdk/client-opensearch';
import { SSMClient } from '@aws-sdk/client-ssm';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { AwsCredentialIdentity } from '@smithy/types';
import { ulid } from 'ulid';

async function getTemporaryCredentials(region: string, roleArn: string): Promise<AwsCredentialIdentity> {
	const stsClient = new STSClient({ region });
	const command = new AssumeRoleCommand({
		RoleArn: roleArn,
		RoleSessionName: `agie-cli-${ulid()}`,
	});
	const { Credentials } = await stsClient.send(command);
	return { accessKeyId: Credentials?.AccessKeyId || '', secretAccessKey: Credentials?.SecretAccessKey || '', sessionToken: Credentials?.SessionToken || '' };
}

async function getSSMClient(region: string, roleArn?: string): Promise<SSMClient> {
	const credentials = roleArn ? await getTemporaryCredentials(region, roleArn) : undefined;
	return new SSMClient({ region, credentials });
}

const getEc2Client = async (region: string, roleArn?: string): Promise<EC2Client> => {
	const credentials = roleArn ? await getTemporaryCredentials(region, roleArn) : undefined;

	return new EC2Client({ region, credentials });
};

const getOpenSearchClient = async (region: string, roleArn?: string): Promise<OpenSearchClient> => {
	const credentials = roleArn ? await getTemporaryCredentials(region, roleArn) : undefined;

	return new OpenSearchClient({ region, credentials });
};

async function getCloudFormationClient(region: string, roleArn?: string): Promise<CloudFormationClient> {
	const credentials = roleArn ? await getTemporaryCredentials(region, roleArn) : undefined;
	return new CloudFormationClient({ region, credentials });
}

export { getCloudFormationClient, getEc2Client, getOpenSearchClient, getSSMClient };

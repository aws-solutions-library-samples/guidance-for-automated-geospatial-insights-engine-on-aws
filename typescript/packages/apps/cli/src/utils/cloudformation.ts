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

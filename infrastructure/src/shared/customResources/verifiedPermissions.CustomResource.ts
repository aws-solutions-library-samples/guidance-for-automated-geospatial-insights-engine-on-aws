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

import { GetParameterCommand, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { CreateIdentitySourceCommand, DeleteIdentitySourceCommand, VerifiedPermissionsClient } from '@aws-sdk/client-verifiedpermissions';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';

const ssmClient = new SSMClient({});
const avpClient = new VerifiedPermissionsClient({});

export const identitySourceIdParameter = (environment: string) => `/agie/${environment}/shared/verifiedPermissionsIdentitySourceId`;

const addIdentitySource = async (environment: string, userPoolArn: string, policyStoreId: string): Promise<void> => {
	console.log(`verifiedPermissions.customResource > addIdentitySource > in`);

	const command = new CreateIdentitySourceCommand({
		policyStoreId,
		principalEntityType: 'Agie::User',
		configuration: {
			cognitoUserPoolConfiguration: {
				userPoolArn,
			},
		},
	});
	const res = await avpClient.send(command);

	await ssmClient.send(
		new PutParameterCommand({
			Name: identitySourceIdParameter(environment),
			Value: res.identitySourceId,
			Type: 'String',
			Overwrite: true,
		})
	);

	if (!res.identitySourceId) throw Error('Failed to create Identity Source');
};

const deleteIdentitySource = async (policyStoreId: string, identitySourceId: string): Promise<void> => {
	console.log(`verifiedPermissions.customResource > deleteIdentitySource > in`);

	try {
		const command = new DeleteIdentitySourceCommand({
			policyStoreId,
			identitySourceId,
		});
		await avpClient.send(command);
	} catch (e) {
		// swallow
	}
};

const safeGetParam = async (param: string): Promise<string | undefined> => {
	try {
		return (await ssmClient.send(new GetParameterCommand({ Name: param })))?.Parameter?.Value;
	} catch (e) {
		if (e.name === 'ParameterNotFound') {
			return undefined;
		}
		throw e;
	}
};

export const handler = async (event: CloudFormationCustomResourceEvent): Promise<any> => {
	console.log(`verifiedPermissions.customResource > handler > in : ${JSON.stringify(event)}`);

	const { USER_POOL_ARN, POLICY_STORED_ID, IDENTITY_STORE_ID_PARAMETER, ENVIRONMENT } = process.env;

	const [identityStoreId] = await Promise.all([safeGetParam(IDENTITY_STORE_ID_PARAMETER)]);

	try {
		switch (event.RequestType) {
			case 'Create':
				await addIdentitySource(ENVIRONMENT, USER_POOL_ARN, POLICY_STORED_ID);
				break;
			case 'Update':
				await deleteIdentitySource(POLICY_STORED_ID, identityStoreId);
				await addIdentitySource(ENVIRONMENT, USER_POOL_ARN, POLICY_STORED_ID);
				break;
			case 'Delete':
				await deleteIdentitySource(POLICY_STORED_ID, identityStoreId);
				break;
			default: {
				console.log(`verifiedPermissions.customResource > unknown request type`);
			}
		}
	} catch (e) {
		console.log(`verifiedPermissions.customResource > error : ${e}`);
	}
	console.log(`verifiedPermissions.customResource > exit`);
};

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
// @ts-ignore
import { userPoolClientIdParameter, userPoolIdParameter } from '@arcade/infrastructure';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Amplify } from 'aws-amplify';
import { confirmSignIn, fetchAuthSession, getCurrentUser, signIn } from 'aws-amplify/auth';
import ow from 'ow';

export interface AuthorizerUserProps {
	environment: string;
	username: string;
	password: string;
	newPassword?: string;
}

export async function generateAuthToken(props: AuthorizerUserProps): Promise<string> {
	ow(props, ow.object.nonEmpty);
	ow(props.environment, ow.string.nonEmpty);
	ow(props.username, ow.string.nonEmpty);
	ow(props.password, ow.string.nonEmpty);

	const userPoolClientId = await getParameterValue(userPoolClientIdParameter(props.environment));
	const userPoolId = await getParameterValue(userPoolIdParameter(props.environment));

	Amplify.configure({
		Auth: {
			Cognito: {
				userPoolId,
				userPoolClientId,
			},
		},
	});

	try {
		let loginFlowFinished = false;
		while (!loginFlowFinished) {
			const user = await signIn({
				username: props.username,
				password: props.password,
				options: {
					authFlowType: 'USER_SRP_AUTH',
				},
			});
			if (user.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
				if (props.newPassword) {
					await confirmSignIn({ challengeResponse: props.newPassword });
				} else {
					await confirmSignIn({ challengeResponse: props.password });
				}
			}

			const { signInDetails } = await getCurrentUser();
			if (signInDetails?.authFlowType === 'USER_SRP_AUTH') {
				const { idToken } = (await fetchAuthSession()).tokens ?? {};
				loginFlowFinished = true;
				return idToken.toString();
			}
		}
	} catch (err: any) {
		// swallow errors but log incase of false positive
		console.log(`authorizeUser: err: ${err}`);
		throw err;
	}

	return '';
}

async function getParameterValue(path: string): Promise<string> {
	const ssm = new SSMClient({});
	const response = await ssm.send(
		new GetParameterCommand({
			Name: path,
		})
	);
	return response.Parameter?.Value as string;
}

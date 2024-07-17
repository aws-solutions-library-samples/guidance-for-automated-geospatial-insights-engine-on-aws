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

import { Amplify } from 'aws-amplify';
import { signIn } from '@aws-amplify/auth';
import { fetchAuthSession } from '@aws-amplify/core';
import { AdminSetUserPasswordCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { error } from 'console';

// use https://jwt.io/ to manually encode/decode tokens for testing
// export const CONTRIBUTOR_TOKEN =
// 	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJlbWFpbCI6InNvbWVvbmVAc29tZXdoZXJlLmNvbSIsImlkZW50aXRpZXMiOlt7InVzZXJJZCI6ImpvaG5kb2UifV0sImNvZ25pdG86Z3JvdXBzIjpbImNvbnRyaWJ1dG9yIl19.dS9JSmW9XHh19bQiUQpMCc3MlrtFavN4658MExpLjfc';

export async function authorizeUser(username: string, password: string, newPassword?: string): Promise<string> {
	let userPoolId = process.env.COGNITO_USER_POOL_ID;
	let clientId = process.env.COGNITO_CLIENT_ID;

	const cognito = new CognitoIdentityProviderClient({});
	Amplify.configure({
		Auth: {
			Cognito: {
				userPoolId: userPoolId,
				userPoolClientId: clientId,
			},
		},
	});
	// check if env has username and password
	if (!process.env.COGNITO_CLIENT_ID) {
		throw error('COGNITO_CLIENT_ID not defined');
	}
	if (!process.env.ADMIN_USER_USERNAME && !username) {
		throw error('Username not defined');
	}
	if (!process.env.ADMIN_USER_PASSWORD && !password) {
		throw error('Password not defined');
	}
	// generate a token
	if (!process.env.COGNITO_USER_POOL_ID) {
		throw error('COGNITO_USER_POOL_ID not defined');
	}

	try {
		let loginFlowFinished = false;
		while (!loginFlowFinished) {
			const user = await signIn({
				username,
				password,
				options: {
					authFlowType: 'USER_SRP_AUTH',
					clientMetadata: {
						clientId,
						userPool: userPoolId,
					},
				},
			});
			if (user.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
				if (newPassword) {
					password = newPassword;
				}

				await cognito.send(
					new AdminSetUserPasswordCommand({
						Username: username,
						UserPoolId: userPoolId,
						Password: password,
						Permanent: true,
					})
				);
			}
			if (user?.isSignedIn) {
				const tokens = (await fetchAuthSession({})).tokens;
				const idToken = tokens?.idToken?.toString();
				loginFlowFinished = true;
				return idToken;
			}
		}
	} catch (err) {
		if (err.name === 'UserAlreadyAuthenticatedException') {
			const tokens = (await fetchAuthSession({})).tokens;
			return tokens?.idToken?.toString();
		} else {
			// swallow errors but log incase of false positive
			console.log(`authorizeUser: err: ${JSON.stringify(err)}`);
		}
		return undefined;
	}

	return '';
}

export async function getAuthToken(username?: string, password?: string, token?: string): Promise<string> {
	if (!token || token === 'NotAuthorizedException') {
		token = await authorizeUser(username, password);
	}
	return token;
}

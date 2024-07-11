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

import { Flags } from '@oclif/core';
import { DeploymentCommand } from '../types/deploymentCommand.js';
import { Amplify } from 'aws-amplify';
import { confirmSignIn, fetchAuthSession, getCurrentUser, signIn } from 'aws-amplify/auth';
import { getParameterValue } from "../utils/ssm.js";

export interface AuthorizerUserProps {
	environment: string;
	username: string;
	password: string;
	newPassword?: string;
}

export const userPoolIdParameter = (environment: string) => `/arcade/${environment}/shared/cognitoUserPoolId`;
export const userPoolClientIdParameter = (environment: string) => `/arcade/${environment}/shared/cognitoUserPoolClientId`;

export class Auth extends DeploymentCommand<typeof Auth> {
	public static description = 'Walks the user through the authentication process to generate a JWT token for making API calls.';
	public static flags = {
		environment: Flags.string({
			char: 'e',
			required: true,
			description: 'The environment to authenticate against.',
		}),
		username: Flags.string({
			char: 'u',
			required: true,
			description: 'The username to generate the token for.',
		}),
		password: Flags.string({
			char: 'p',
			required: true,
			description: 'The password of the user.',
		}),
		newPassword: Flags.string({
			char: 'n',
			required: false,
			description: 'The new password to be set for the user.',
		}),
	};

	public static examples = [
		'<%= config.bin %> <%= command.id %> -e prod -r us-west-2 -u username -p password',
		'<%= config.bin %> <%= command.id %> -e prod -r us-west-2 -u username -p password -n newPassword',
	];

	private async generateAuthToken(props: AuthorizerUserProps): Promise<string> {
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

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(Auth);
		try {
			const token = await this.generateAuthToken({
				environment: flags.environment,
				username: flags.username,
				password: flags.password,
				newPassword: flags.newPassword,
			});
			console.log(token);
		} catch (error) {
			console.log(JSON.stringify(error));
		}
		// TODO: add error handling
	}
}

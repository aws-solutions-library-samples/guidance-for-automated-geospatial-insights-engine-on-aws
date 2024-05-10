/*
 *    Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *    with the License. A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *    OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *    and limitations under the License.
 */

import { Flags } from '@oclif/core';
import { generateAuthToken } from '@arcade/helpers';
import { DeploymentCommand } from '../types/deploymentCommand.js';

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

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(Auth);
		try {
			const token = await generateAuthToken({
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

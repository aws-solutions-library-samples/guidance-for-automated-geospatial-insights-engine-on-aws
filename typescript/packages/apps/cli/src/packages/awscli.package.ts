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

import { ListrTask } from 'listr2';
import { execAsync } from '../utils/shell.js';
import { BasePackage } from './base.package.js';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : true;
export class AwsCliPackage extends BasePackage {
	getLinuxTasks(): ListrTask[] {
		return [
			{
				title: 'Installing AWS CLI',
				task: async () => {
					try {
						await execAsync('aws --version | grep -q "aws-cli/2."', { silent: isSilent });
					} catch (error) {
						await execAsync('curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"', { silent: isSilent });
						await execAsync('unzip -o awscliv2.zip', { silent: isSilent });
						await execAsync('sudo ./aws/install --update', { silent: isSilent });
					}
				},
			},
		];
	}

	getMacTasks(): ListrTask[] {
		return [
			{
				title: 'Installing AWS CLI',
				task: async () => {
					try {
						await execAsync('aws --version | grep -q "aws-cli/2."', { silent: isSilent });
					} catch (error) {
						await execAsync('curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"', { silent: isSilent });
						await execAsync('installer -pkg ./AWSCLIV2.pkg -target /', { silent: false });
					}
				},
			},
		];
	}

	getWindowsTasks(): ListrTask[] {
		this.logger.log('AWS CLI in Windows cannot be installed through command line');
		return [
			{
				title: 'Installing AWS CLI',
				skip: () => true,
				task: async () => {},
			},
		];
	}
}

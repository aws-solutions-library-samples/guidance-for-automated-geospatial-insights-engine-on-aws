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
import * as fs from 'fs';
import { Listr } from 'listr2';
import { Observable } from 'rxjs';
import { default as shell, default as shelljs } from 'shelljs';
import { AgieCommand } from '../types/agieCommand.js';
import { AnswersBuilder } from '../utils/answers.js';
import { switchToAgieInfrastructureFolder } from '../utils/shell.js';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : false;

export class AgieRemove extends AgieCommand<typeof AgieRemove> {
	public static description = 'Remove AGIE for the specified environment';
	public static examples = ['$ <%= config.bin %> <%= command.id %> -e stage -r us-west-2'];
	public static enableJsonFlag = true;

	public static flags = {
		environment: Flags.string({
			char: 'e',
			required: true,
			description: 'The environment used to deploy the agie project to.',
		}),
		region: Flags.string({
			char: 'r',
			required: true,
			description: 'The AWS Region agie is deployed to.',
		}),
		role: Flags.string({
			description: 'The RoleArn for the CLI to assume for deployment.',
			char: 'l',
		}),
	};

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(AgieRemove);
		const { role, region, environment } = flags;

		const infrastructureFolder = await switchToAgieInfrastructureFolder();

		const taskRunner = new Listr([
			{
				title: 'Generating cdk.context.json',
				task: async () => {
					const answersBuilder = new AnswersBuilder(environment, region, role);
					fs.writeFileSync(`${infrastructureFolder}/cdk.context.json`, JSON.stringify(await answersBuilder.loadFromParameterStore()));
				},
			},
			{
				title: 'Removing AGIE stacks',
				task: () => {
					return new Observable((observer) => {
						shell.cd(infrastructureFolder);

						var child = shelljs.exec(
							`export AWS_REGION=${region} && export AWS_DEFAULT_REGION=${region} && npm run cdk -- destroy --all --concurrency=10 --force ${role ? '--r ' + role : ''} -c environment=${environment}`,
							{ async: true, silent: isSilent },
						);

						child?.stdout?.on('data', function (data) {
							observer.next(data);
						});

						child?.stderr?.on('data', function (data) {
							observer.next(data);
						});

						child.on('exit', function () {
							observer.complete();
						});
					});
				},
			},
		]);

		await taskRunner.run();
	}
}

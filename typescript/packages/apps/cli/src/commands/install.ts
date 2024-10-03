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
import Ajv from 'ajv';
import * as fs from 'fs';
import { Listr, ListrTask } from 'listr2';
import { Observable } from 'rxjs';
import { default as shell, default as shelljs } from 'shelljs';
import { simpleGit } from 'simple-git';
import { promisify } from 'util';
import { AgieCommand } from '../types/agieCommand.js';
import { AnswersBuilder, ContextAnswer, schema } from '../utils/answers.js';
import { getDeployedStackByName } from '../utils/cloudformation.js';
import { switchToAgieInfrastructureFolder, switchToAgieRootFolder } from '../utils/shell.js';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : false;

const execAsync = promisify<string, { silent: boolean }, string>(shell.exec);

export class AgieInstall extends AgieCommand<typeof AgieInstall> {
	public static description = 'Install AGIE for the specified environment';
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
		config: Flags.string({
			char: 'c',
			description: 'Path to configuration file used for deployment.',
		}),
		headless: Flags.boolean({
			char: 'h',
			description: 'If provided, bypass the questions. You will also need to specify the path configuration file using -c',
			dependsOn: ['config'],
		}),
		role: Flags.string({
			description: 'The RoleArn for the CLI to assume for deployment.',
			char: 'l',
		}),
	};

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(AgieInstall);
		const { role, region, headless, config, ...rest } = flags;

		const answers = await this.getAnswersTask(flags.environment, region, role!, headless, config);

		const installTasks = await this.getAgieInstallTask(flags.role!, region, rest);

		const taskRunner: Listr = new Listr([this.getStacServerBundleTask(), ...installTasks], { exitOnError: true });

		await taskRunner.run({ answers });
	}

	private async getAnswersTask(environment: string, region: string, role: string, headless: boolean, config?: string): Promise<ContextAnswer> {
		const answersBuilder = new AnswersBuilder(environment, region, role);
		let answers: ContextAnswer;

		if (config) {
			answers = JSON.parse(fs.readFileSync(config!, { encoding: 'utf8' }));
			const ajv = new Ajv.Ajv();
			// Validate schema
			const validate = ajv.compile(schema);
			if (!validate(answers)) {
				throw new Error(JSON.stringify(validate.errors));
			}
		} else {
			answers = await answersBuilder.loadFromParameterStore();
		}

		if (!headless) {
			answers = await answersBuilder.loadFromUsers(answers);
		}

		await answersBuilder.saveToParameterStore(answers);
		return answers;
	}

	private async getAgieInstallTask(role: string, region: string, rest: Record<string, string>): Promise<ListrTask[]> {
		const params = Object.entries(rest)
			.map(([k, v]) => `-c ${k}=${v}`)
			.join(' ');

		const infrastructureFolder = await switchToAgieInfrastructureFolder();

		return [
			{
				title: 'Generating cdk.context.json',
				task: (ctx) => {
					const answers = ctx.answers;
					fs.writeFileSync(`${infrastructureFolder}/cdk.context.json`, JSON.stringify(answers));
				},
			},
			{
				title: 'Boostrapping cdk',
				task: async (_, task) => {
					try {
						await getDeployedStackByName('CDKToolkit', region, role);
						task.skip('Skip boostrapping cdk');
						return;
					} catch (error) {
						if ((error as Error).message === 'Stack with id CDKToolkit does not exist') {
							task.output = `CDK has not been bootstrapped in ${region}, running bootstrap...`;
							shell.cd(infrastructureFolder);
							await execAsync(
								`export AWS_REGION=${region} && export AWS_DEFAULT_REGION=${region} && npm run cdk -- bootstrap --all --concurrency=10 ${role ? '--r ' + role : ''} ${params}`,
								{
									silent: isSilent,
								},
							);
						}
					}
				},
			},
			{
				title: 'Deploying AGIE stacks',
				task: async (ctx, task) => {
					return new Observable((observer) => {
						shell.cd(infrastructureFolder);

						var child = shelljs.exec(
							`export AWS_REGION=${region} && export AWS_DEFAULT_REGION=${region} && npm run cdk -- deploy --all --concurrency=10 --require-approval never ${role ? '--r ' + role : ''} ${params}`,
							{ async: true, silent: isSilent },
						);

						child?.stdout?.on('data', function (data) {
							observer.next(data);
						});

						child?.stderr?.on('data', function (data) {
							observer.next(data);
						});

						child.on('exit', function (code: number) {
							if (code === 1) {
								observer.error('Encountered error when deploying AGIE stacks');
							} else {
								observer.complete();
							}
						});
					});
				},
			},
			{
				title: 'Deploying the demo UI',
				task: async () => {
					return new Observable((observer) => {
						shell.cd(`${infrastructureFolder}/../typescript/packages/apps/ui`);
						var child = shelljs.exec(`export ENVIRONMENT=${rest['environment']} && export AWS_REGION=${region} &&  npm run deploy`, { async: true, silent: isSilent });
						child?.stdout?.on('data', function (data) {
							observer.next(data);
						});

						child?.stderr?.on('data', function (data) {
							observer.next(data);
						});

						child.on('exit', function (code: number) {
							if (code === 1) {
								observer.error('Encountered error when deploying the demo UI');
							} else {
								observer.complete();
							}
						});
					});
				},
			},
		];
	}

	private getStacServerBundleTask(): ListrTask {
		return {
			title: `Bundling stac-server (https://github.com/stac-utils/stac-server)`,
			task: async (_, task) => {
				const rootFolder = await switchToAgieRootFolder();
				if (
					fs.existsSync(`${rootFolder}/infrastructure/src/stacServer/lambdas/api.zip`) &&
					fs.existsSync(`${rootFolder}/infrastructure/src/stacServer/lambdas/ingest.zip`)
				) {
					task.skip('Skip bundling, stac-server files had been bundled.');
					return;
				}

				const folderName = `${rootFolder}/stac-server`;
				if (!fs.existsSync(folderName)) {
					const repository = `https://github.com/stac-utils/stac-server.git`;
					task.output = `Cloning 📦 ${repository} into 📁 ${rootFolder}`;
					const stacServerGit = simpleGit().outputHandler((_command, stdout, stderr) => {
						stderr.pipe(process.stderr);
					});
					await stacServerGit.clone(repository, folderName, { '--depth': 1, '--branch': 'v3.8.0' });
				} else {
					task.output = `Folder ${folderName} already exists`;
				}

				task.output = 'Bundling stac-server lambda and copying to AGIE cdk projects';

				await execAsync(
					`cd stac-server && npm install && npm run build && cp dist/api/api.zip ${rootFolder}/infrastructure/src/stacServer/lambdas && cp dist/ingest/ingest.zip ${rootFolder}/infrastructure/src/stacServer/lambdas`,
					{ silent: isSilent },
				);
			},
		};
	}
}

import { Flags, Command } from '@oclif/core';
import shelljs from 'shelljs';
import { switchToStacServerLocation } from '../../utils/shell.js';
import { getDeployedStacServerMetaData } from '../../utils/cloudformation.js';
import { StacCommand } from '../../types/stacCommand.js';
import { validateMasterPassword } from '../../utils/validator.js';
import { createSecret } from '../../utils/secretManager.js';
import replace from 'replace-in-file';
import { replaceLine } from '../../utils/file.js';
import { authorizerFunctionName } from '@arcade/infrastructure';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : true;

export class StacServerInstall extends StacCommand<typeof StacServerInstall> {
	public static description = 'Install STAC server for the specified environment';
	public static examples = ["$ <%= config.bin %> <%= command.id %> -e stage -r us-west-2 -m 'samplePassword'"];
	public static enableJsonFlag = true;

	public static flags = {
		environment: Flags.string({
			char: 'e',
			required: true,
			description: 'The environment that the STAC server is deployed to',
		}),
		region: Flags.string({
			char: 'r',
			description: 'The region the STAC server is deployed to',
		}),
		masterPassword: Flags.string({
			char: 'm',
			required: true,
			parse: async (input) => validateMasterPassword(input),
			description: 'The master password of Open Search',
		}),
		instanceType: Flags.string({
			char: 't',
			description: 'The instance type used to deploy Open Search',
		}),
		instanceCount: Flags.integer({
			char: 'c',
			description: 'The number of Open Search instances to be deployed',
		}),
		volumeSize: Flags.integer({
			char: 's',
			description: 'The size of volumes for Open Search instances (GiB)',
		}),
		role: Flags.string({
			description: 'The RoleArn for the CLI to assume for deployment',
			char: 'l',
		}),
	};

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(StacServerInstall);
		const location = await switchToStacServerLocation();

		// copy the serveless.yaml for a fresh install
		shelljs.exec('cp serverless.example.yml serverless.yml', { silent: isSilent });

		// Update Open Search instance details in serverless.yaml
		// 1 - replace instance type
		flags?.instanceType ? await replace({ files: `${location}/serverless.yml`, from: 'InstanceType: t3.small.search', to: `InstanceType: ${flags?.instanceType}` }) : '';

		// 2 - replace instance type
		flags?.instanceCount ? await replace({ files: `${location}/serverless.yml`, from: 'InstanceCount: 1', to: `InstanceCount: ${flags?.instanceCount}` }) : '';

		// 3 - replace instance type
		flags?.volumeSize ? await replace({ files: `${location}/serverless.yml`, from: 'VolumeSize: 35', to: `VolumeSize: ${flags?.volumeSize}` }) : '';
		// 4 - update the pre hook config
		const authFunctionName = authorizerFunctionName(flags.environment);
		// Get the accountId
		const accountId = await shelljs
			.exec(`aws sts get-caller-identity|jq -r ".Account" ${flags?.role ? '--profile ' + flags.role : ''}`, {
				silent: isSilent,
			})
			.trim();
		const authFunctionArn = `arn:aws:lambda:${flags.region}:${accountId}:function:${authFunctionName}`;

		await replace({
			files: `${location}/serverless.yml`,
			from: '# PRE_HOOK: ${self:service}-${self:provider.stage}-preHook',
			to: `PRE_HOOK: ${authFunctionName}`,
		});

		await replaceLine(`${location}/serverless.yml`, 60, '        - Effect: Allow');
		await replaceLine(`${location}/serverless.yml`, 61, '          Action: lambda:InvokeFunction');
		await replaceLine(`${location}/serverless.yml`, 62, `          Resource: ${authFunctionArn}`);

		try {
			await getDeployedStacServerMetaData(flags.environment, flags?.role);

			//Disable master password settings
			await replace({ files: `${location}/serverless.yml`, from: 'MasterUserOptions:', to: `# MasterUserOptions:` });
			await replace({ files: `${location}/serverless.yml`, from: 'MasterUserName: admin', to: `# MasterUserName: admin` });
			await replace({
				files: `${location}/serverless.yml`,
				from: 'MasterUserPassword: ${env:OPENSEARCH_MASTER_USER_PASSWORD}',
				to: '#MasterUserPassword: ${env:OPENSEARCH_MASTER_USER_PASSWORD}',
			});

			this.log(`Deploying STAC server to ${flags.region}`);
			await shelljs.exec(`npm run deploy -- --stage ${flags.environment} --region ${flags.region} ${flags?.role ? '--aws-profile ' + flags.role : ''}`, {
				silent: isSilent,
			});

			// Store the master password in secretManager after a successful deployment
			// We only store on first creation, recurring runs will not update the password
			createSecret(`arcade/stacServer/${flags.environment}/credentials`, JSON.stringify({ username: 'admin', password: flags.masterPassword }));
		} catch (error) {
			if ((error as Error).message === `Stack with id stac-server-${flags.environment} does not exist`) {
				if (!flags?.masterPassword) {
					this.log(
						`No previous installation of 'STAC server' detected!!! Please provide a master password for the openSearch cluster using '-m' or '-masterPassword' flag`,
					);
					return;
				}

				this.log(`Deploying STAC server to ${flags.region}`);

				await shelljs.exec(
					`OPENSEARCH_MASTER_USER_PASSWORD='${flags.masterPassword}' npm run deploy -- --stage ${flags.environment} --region ${flags.region} ${flags?.role ? '--aws-profile ' + flags.role : ''}`,
					{
						silent: isSilent,
					},
				);
				// Store the master password in secretManager after a successfull deployment
				createSecret(`arcade/stacServer/${flags.environment}/credentials`, JSON.stringify({ username: 'admin', password: flags.masterPassword }));
			}
		}
		this.log(`Finished Deployment of STAC server to ${flags.region}`);
	}
}

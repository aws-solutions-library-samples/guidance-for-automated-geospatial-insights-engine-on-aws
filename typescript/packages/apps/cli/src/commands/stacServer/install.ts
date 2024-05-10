import { Flags, Command } from '@oclif/core';
import shelljs from 'shelljs';
import { switchToStacServerLocation } from '../../utils/shell.js';
import { getDeployedStacServerMetaData } from '../../utils/cloudformation.js';
import { StacCommand } from '../../types/stacCommand.js';
import { validateMasterPassword } from '../../utils/validator.js';
import { saveSecret } from '../../utils/secretManager.js';
import replace from 'replace-in-file';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : true;

export class StacServerInstall extends StacCommand<typeof StacServerInstall> {
	public static description = 'Install STAC server for the specified environment';
	public static examples = ['$ <%= config.bin %> <%= command.id %> -e stage -r us-west-2 -m samplePassword'];
	public static enableJsonFlag = true;

	public static flags = {
		environment: Flags.string({
			char: 'e',
			required: true,
			description: 'The environment that the STAC server is deployed to',
		}),
		region: Flags.string({
			char: 'r',
			required: true,
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
			description: 'The size of volumes for Open Search instances',
		}),
	};

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(StacServerInstall);
		const location = await switchToStacServerLocation();

		// setup the serveless.yaml
		shelljs.exec('cp serverless.example.yml serverless.yml', { silent: isSilent });
		// Update Open Search instance details in serverless.yaml

		// 1 - replace instance type
		flags?.instanceType ? await replace({ files: `${location}/serverless.yml`, from: 'InstanceType: t3.small.search', to: `InstanceType: ${flags?.instanceType}` }) : '';

		// 2 - replace instance type
		flags?.instanceCount ? await replace({ files: `${location}/serverless.yml`, from: 'InstanceCount: 1', to: `InstanceCount: ${flags?.instanceCount}` }) : '';

		// 3 - replace instance type
		flags?.volumeSize ? await replace({ files: `${location}/serverless.yml`, from: 'VolumeSize: 35', to: `VolumeSize: ${flags?.volumeSize}` }) : '';

		try {
			await getDeployedStacServerMetaData(flags.environment, flags?.role);
			this.log(`Deploying STAC server to ${flags.region}`);

			await shelljs.exec(`OPENSEARCH_MASTER_USER_PASSWORD='${flags.masterPassword}' npm run deploy -- --stage ${flags.environment} --region ${flags.region}`, {
				silent: isSilent,
			});

			// Store the master password in secretManager after a successful deployment
			// We only store on first creation, recurring runs will not update the password
			saveSecret(`arcade/stacServer/${flags.environment}/credentials`, JSON.stringify({ username: 'admin', password: flags.masterPassword }));
		} catch (error) {
			if ((error as Error).message === `Stack with id stac-server-${flags.environment} does not exist`) {
				if (!flags?.masterPassword) {
					this.log(
						`No previous installation of 'STAC server' detected!!! Please provide a master password for the openSearch cluster using '-m' or '-masterPassword' flag`,
					);
					return;
				}

				this.log(`Deploying STAC server to ${flags.region}`);
				await shelljs.exec(`OPENSEARCH_MASTER_USER_PASSWORD='${flags.masterPassword}' npm run deploy -- --stage ${flags.environment} --region ${flags.region}`, {
					silent: isSilent,
				});
				// Store the master password in secretManager after a successfull deployment
				saveSecret(`arcade/stacServer/${flags.environment}/credentials`, JSON.stringify({ user: 'admin', password: flags.masterPassword }));
			}
		}
		this.log(`Finished Deployment of STAC server to ${flags.region}`);
	}
}
import { Flags } from '@oclif/core';
import { switchToArcadeLocation } from '../utils/shell.js';
import { getDeployedStackByName } from '../utils/cloudformation.js';
import { ArcadeCommand } from "../types/arcadeCommand.js";
import shell from 'shelljs';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : false;

export class ArcadeInstall extends ArcadeCommand<typeof ArcadeInstall> {
	public static description = 'Install ARCADE for the specified environment';
	public static examples = ['$ <%= config.bin %> <%= command.id %> -e stage -r us-west-2 -a dummyEmail@test.com'];
	public static enableJsonFlag = true;

	public static flags = {
		environment: Flags.string({
			char: 'e',
			required: true,
			description: 'The environment used to deploy the arcade project to',
		}),
		region: Flags.string({
			char: 'r',
			required: true,
			description: 'The AWS Region arcade is deployed to',
		}),
		sentinelTopicArn: Flags.string({
			char: 's',
			required: false,
			default: 'arn:aws:sns:eu-central-1:214830741341:SentinelS2L2A',
			description: 'New scene notifications for L2A images (https://registry.opendata.aws/sentinel-2/)',
		}),
		administratorEmail: Flags.string({
			char: 'a',
			required: true,
			description: 'The administrator Email address',
		}),
		administratorPhoneNumber: Flags.string({
			char: 'n',
			required: true,
			description: 'Enter the administrator phone number, including + and the country code, for example +12065551212.',
		}),
		role: Flags.string({
			description: 'The RoleArn for the CLI to assume for deployment',
			char: 'l',
		}),
	};

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(ArcadeInstall);
		await switchToArcadeLocation();

		const params = `-c sentinelTopicArn=${flags.sentinelTopicArn} -c environment=${flags.environment}  -c administratorEmail=${flags.administratorEmail} -c administratorPhoneNumber=${flags.administratorPhoneNumber} `;

		try {
			await getDeployedStackByName('CDKToolkit', flags?.role);
		} catch (error) {
			if ((error as Error).message === 'Stack with id CDKToolkit does not exist') {
				shell.exec(`npm run cdk -- bootstrap --all --concurrency=10 ${flags?.role ? '--r ' + flags.role : ''} ${params}`, { silent: isSilent });
			}
		}
		shell.exec(`npm run cdk -- deploy --all --concurrency=10 --require-approval never ${flags?.role ? '--r ' + flags.role : ''} ${params}`, { silent: isSilent });
		this.log(`Finished Deployment of Arcade to ${flags.region}`);
	}
}

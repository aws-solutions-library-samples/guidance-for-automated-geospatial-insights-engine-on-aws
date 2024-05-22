import { Flags } from '@oclif/core';
import { switchToArcadeLocation } from '../../utils/shell.js';
import { getDeployedStackByName, getDeployedStacServerMetaData } from '../../utils/cloudformation.js';
import { StacCommand } from '../../types/stacCommand.js';
import shell from 'shelljs';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : false;

export class ArcadeInstall extends StacCommand<typeof ArcadeInstall> {
	public static description = 'Install Arcade for the specified environment';
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
		const folder = await switchToArcadeLocation();

		const stacServerMetadata = await getDeployedStacServerMetaData(flags.environment);
		const params = `-c environment=${flags.environment} -c stacServerUrl=${stacServerMetadata.stacServerUrl} -c administratorEmail=${flags.administratorEmail} -c administratorPhoneNumber=${flags.administratorPhoneNumber} -c stacServerTopicArn=${stacServerMetadata.ingestionTopicArn} -c stacServerFunctionName=${stacServerMetadata.apiLambdaFunctionName} -c stacServerOpenSearchEndpoint=${stacServerMetadata.openSearchEndPoint} -c stacServerOpenSearchSecret=arcade/stacServer/${flags.environment}/credentials`;

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

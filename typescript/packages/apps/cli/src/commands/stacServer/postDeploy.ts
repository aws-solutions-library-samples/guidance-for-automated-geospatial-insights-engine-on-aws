import { Flags } from '@oclif/core';
import shelljs from 'shelljs';
import { switchToStacServerLocation } from '../../utils/shell.js';
import { getDeployedStacServerMetaData } from '../../utils/cloudformation.js';
import { StacCommand } from '../../types/stacCommand.js';
import config from '../../utils/config.js';
import { createOpenSearchRole, createOpenSearchUser, createStacServerCatalog, enableCollectionIndex, linkOpenSearchUserToRole } from '../../utils/stacServer.js';
import { getSSMClient } from '../../utils/awsClient.js';
import { GetParameterCommand } from '@aws-sdk/client-ssm';
import { putSecret } from '../../utils/secretManager.js';
import { validateUserPassword } from '../../utils/validator.js';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : true;

export class StacServerPostDeploy extends StacCommand<typeof StacServerPostDeploy> {
	public static description = 'collect the stac server metadata for use in arcade';
	public static examples = ["$ <%= config.bin %> <%= command.id %> -e stage -r use-west-2 -p 'samplePassword'"];

	public static enableJsonFlag = true;

	public static flags = {
		environment: Flags.string({
			char: 'e',
			required: true,
			description: 'The environment of the stac server',
		}),
		password: Flags.string({
			char: 'p',
			required: true,
			parse: async (input) => validateUserPassword(input),
			description: 'The user password for the stac-server user',
		}),
		region: Flags.string({
			char: 'r',
			required: true,
			description: 'The region of the stac server',
		}),
		role: Flags.string({
			description: 'The RoleArn for the CLI to assume for deployment',
			char: 'l',
		}),
	};

	public async runChild(): Promise<void> {
		const { flags } = await this.parse(StacServerPostDeploy);
		await switchToStacServerLocation();
		try {
			// Capture the stac server metadata for use in arcade
			const stacMetaData = await getDeployedStacServerMetaData(flags.environment, flags?.role);
			config.set('stacServerApiLambdaFunctionName', stacMetaData.apiLambdaFunctionName);
			config.set('stacServerIngestionLambdaFunctionName', stacMetaData.ingestionLambdaFunctionName);
			config.set('stacServerIngestionTopicArn', stacMetaData.ingestionTopicArn);
			config.set('stacServerOpenSearchEndPoint', stacMetaData.openSearchEndPoint);

			// get the stacServerInitializerLambdaFunctionName parameter
			const ssmClient = await getSSMClient(flags?.role);
			const param = await ssmClient.send(
				new GetParameterCommand({
					Name: `/arcade/${flags.environment}/stacServer/initializerFunctionName`,
					WithDecryption: true,
				}),
			);
			config.set('stacServerInitializerLambdaFunctionName', param.Parameter.Value);

			/**
			 * Configure opensearch
			 * 1- Create the role
			 * 2- Create the user
			 * 3- Link the user and role
			 * 4- Create the user credentials in secret manager
			 * 5- Redeploy the stac server
			 * 6- enable the collection index
			 * 7- Create the catalog
			 */
			// 1- Create the role
			await createOpenSearchRole();
			// 2- Create the user
			await createOpenSearchUser(flags.password);
			// 3- Link the user and role
			await linkOpenSearchUserToRole();
			// 4- Create the user credentials in secret manager
			await putSecret(`stac-server-${flags.environment}-opensearch-user-creds`, JSON.stringify({ username: 'stac_server', password: flags.password }));
			// 5- Redeploy the stac server
			this.log(`Re-deploying stac-server to ${flags.region}`);
			shelljs.exec(`npm run deploy -- --stage ${flags.environment} --region ${flags.region} ${flags?.role ? '--aws-profile ' + flags.role : ''}`, {
				silent: isSilent,
			});
			this.log(`Finished deploying stac-server to ${flags.region}`);

			// 6- enable the collection index
			await enableCollectionIndex();

			// 7- Create the catalog
			const eventBridgeNameParam = await ssmClient.send(
				new GetParameterCommand({
					Name: `/arcade/${flags.environment}/shared/eventBusName`,
					WithDecryption: true,
				}),
			);
			config.set('arcadeEventBridgeName', eventBridgeNameParam.Parameter.Value);
			await createStacServerCatalog();
		} catch (error) {
			this.log(JSON.stringify(error));
			if ((error as Error).message === `Stack with id stac-server-${flags.environment} does not exist`) {
				this.log(`No previous installation of 'stac-server' detected!!!`);
				return;
			}
		}
		this.log(`Finished updating configuration for stac-server-${flags.environment}`);
	}
}

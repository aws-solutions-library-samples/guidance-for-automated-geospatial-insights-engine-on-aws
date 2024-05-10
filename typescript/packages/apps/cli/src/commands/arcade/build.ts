import { ArcadeCommand } from '../../types/arcadeCommand.js';
import shell from 'shelljs';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : false;

export default class ArcadeBuild extends ArcadeCommand<typeof ArcadeBuild> {
	public static description = 'Performs build operations for arcade';
	public static examples = ['<%= config.bin %> <%= command.id %>'];

	public async runChild(): Promise<void> {
		const commands = ['. ~/.nvm/nvm.sh', 'nvm use v20.11.1', 'rush update --bypass-policy', 'rush rebuild'];
		shell.exec(commands.join(this.bashAndOperator), { silent: isSilent });
	}
}

import { StacCommand } from '../../types/stacCommand.js';
import shell from 'shelljs';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : true;

export default class StacServerBuild extends StacCommand<typeof StacServerBuild> {
	public static description = 'Performs build of the stac server';
	public static examples = ['<%= config.bin %> <%= command.id %>'];

	public async runChild(): Promise<void> {
		const commands = ['. ~/.nvm/nvm.sh', 'nvm use v20.11.1', 'npm install', 'npm run build'];
		shell.exec(commands.join(this.bashAndOperator), { silent: isSilent });
	}
}

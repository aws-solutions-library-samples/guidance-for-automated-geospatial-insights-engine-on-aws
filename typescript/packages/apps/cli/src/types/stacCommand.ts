import { Command } from '@oclif/core';
import { switchToStacServerLocation } from '../utils/shell.js';

export abstract class StacCommand<T extends typeof Command> extends Command {
	protected bashAndOperator = ' && ';

	abstract runChild(): Promise<Record<string, unknown> | Record<string, unknown>[] | void>;

	public async run(): Promise<Record<string, unknown> | Record<string, unknown>[] | void> {
		await switchToStacServerLocation();
		return await this.runChild();
	}
}

import { Command } from '@oclif/core';
import { switchToArcadeLocation } from '../utils/shell.js';

export abstract class ArcadeCommand<T extends typeof Command> extends Command {
	protected bashAndOperator = ' && ';

	abstract runChild(): Promise<Record<string, unknown> | Record<string, unknown>[] | void>;

	public async run(): Promise<Record<string, unknown> | Record<string, unknown>[] | void> {
		await switchToArcadeLocation();
		return await this.runChild();
	}
}

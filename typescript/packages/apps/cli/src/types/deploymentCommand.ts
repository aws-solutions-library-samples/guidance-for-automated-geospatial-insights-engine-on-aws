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

import { Command, Flags, Parser } from '@oclif/core';
import { ArgOutput, FlagOutput, Input, ParserOutput } from '@oclif/core/lib/interfaces/parser.js';
import shelljs from 'shelljs';

export abstract class DeploymentCommand<T extends typeof Command> extends Command {
	abstract runChild(): Promise<Record<string, unknown> | Record<string, unknown>[] | string | void>;

	static baseFlags = {
		region: Flags.string({
			description: 'AWS region used when running the subcommands',
			char: 'r',
		}),
		role: Flags.string({
			description: 'The RoleArn for the CLI to assume for deployment',
			char: 'l',
		}),
	};

	public async parse<F extends FlagOutput, B extends FlagOutput, A extends ArgOutput>(options?: Input<F, B, A>, argv = this.argv): Promise<ParserOutput<F, B, A>> {
		if (!options) options = this.ctor as unknown as Input<F, B, A>;
		const opts = { context: this, ...options };
		// @ts-ignore
		opts.flags = {
			...(options?.flags ?? {}),
		};
		opts.args = options?.args;
		const results = await Parser.parse<F, B, A>(argv, opts);
		this.warnIfFlagDeprecated(results.flags ?? {});

		return results;
	}

	public async run(): Promise<Record<string, unknown> | Record<string, unknown>[] | string | void> {
		const { flags } = await this.parse();
		if (flags.region) {
			// used by aws cdk running in child shell
			shelljs.env.ARCADE_REGION = flags.region;
			// used by aws sdk running in current shell
			process.env.ARCADE_REGION = flags.region;
		}
		return await this.runChild();
	}
}

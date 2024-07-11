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

import { ArcadeCommand } from '../types/arcadeCommand.js';
import shell from 'shelljs';

const { SILENT_COMMAND_EXECUTION: isSilentStr } = process.env;
const isSilent = isSilentStr ? isSilentStr === 'true' : false;

export default class ArcadeBuild extends ArcadeCommand<typeof ArcadeBuild> {
	public static description = 'Performs build operations for ARCADE';
	public static examples = ['<%= config.bin %> <%= command.id %>'];

	public async runChild(): Promise<void> {
		const commands = ['. ~/.nvm/nvm.sh', 'nvm use v20.11.1', 'rush update --bypass-policy', 'rush rebuild'];
		shell.exec(commands.join(this.bashAndOperator), { silent: isSilent });
	}
}

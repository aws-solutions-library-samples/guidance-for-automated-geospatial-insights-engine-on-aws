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

import { ListrTask } from "listr2";
import { execAsync } from "../utils/shell.js";
import { BasePackage } from "./base.package.js";

const { SILENT_COMMAND_EXECUTION:isSilentStr } = process.env;
const isSilent = (isSilentStr) ? isSilentStr === "true": true ;
export class NpmPackage extends BasePackage {
	private commands =
		[
			{
				title: "Installing rush", command: "npm install -g @microsoft/rush"
			}
		];

	private installTasks = this.commands.map(c => {
		return {
			title: c.title,
			task: async () => {
				await execAsync(c.command, { silent: isSilent });
			}
		};
	});

	getLinuxTasks(): ListrTask[] {
		return this.installTasks;
	}

	getMacTasks(): ListrTask[] {
		return this.installTasks;
	}

	getWindowsTasks(): ListrTask[] {
		return this.installTasks;
	}
}

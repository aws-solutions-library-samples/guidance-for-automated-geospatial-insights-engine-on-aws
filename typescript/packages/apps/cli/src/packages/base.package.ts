/*
 *    Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *    with the License. A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *    OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *    and limitations under the License.
 */

import { ListrTask } from "listr2";
import * as os from "os";

export interface Logger {
	log(message: string): void;

	error(message: string): void;
}

export abstract class BasePackage {
	public constructor(protected logger: Logger) {
	}

	abstract getMacTasks(): ListrTask[];

	abstract getLinuxTasks(): ListrTask[];

	abstract getWindowsTasks(): ListrTask[];

	public getTasks(): ListrTask[] {
		switch (os.platform()) {
			case "darwin":
				return this.getMacTasks();
			case "linux":
				return this.getLinuxTasks();
			case "win32":
				return this.getWindowsTasks();
			default:
				this.logger.error("the platform is not supported");
				return [];
		}
	}
}

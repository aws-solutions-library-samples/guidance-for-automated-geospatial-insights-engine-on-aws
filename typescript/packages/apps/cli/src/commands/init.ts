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

import { Command } from "@oclif/core";
import { Listr } from "listr2";
import { AwsCliPackage } from "../packages/awscli.package.js";
import { NodePackage } from "../packages/node.package.js";
import { NpmPackage } from "../packages/npm.package.js";


export default class Init extends Command {
	public static description = "Install ARCADE dependencies";
	public static examples = [
		"$ arcade init",
	];

	public async run(): Promise<void> {
		const tasks = new Listr([
			...new AwsCliPackage(this).getTasks(),
			...new NodePackage(this).getTasks(),
			...new NpmPackage(this).getTasks()]);
		await tasks.run();
	}
}

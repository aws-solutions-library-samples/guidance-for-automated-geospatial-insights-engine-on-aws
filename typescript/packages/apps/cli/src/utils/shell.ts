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

import rushlib from '@microsoft/rush-lib';
import path from 'path';
import shell from 'shelljs';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify<string, { silent: boolean }, string>(shell.exec);

export type Folder = string;

const switchToAgieRootFolder = async (): Promise<Folder> => {
	const agieFolder = path.join(__dirname, '../../../../../..');
	shell.cd(agieFolder);
	return agieFolder!;
};

const switchToAgieInfrastructureFolder = async (): Promise<Folder> => {
	const agieFolder = path.join(__dirname, '../../../../../..');

	const rushConfiguration = rushlib.RushConfiguration.loadFromDefaultLocation({
		startingFolder: agieFolder,
	});

	const moduleConfiguration = rushConfiguration.findProjectByShorthandName('@agie/infrastructure');
	if (!moduleConfiguration) {
		throw new Error('Module @agie/infrastructure does not exist');
	}
	shell.cd(moduleConfiguration.projectFolder);
	return moduleConfiguration.projectFolder;
};

export { execAsync, switchToAgieInfrastructureFolder, switchToAgieRootFolder };

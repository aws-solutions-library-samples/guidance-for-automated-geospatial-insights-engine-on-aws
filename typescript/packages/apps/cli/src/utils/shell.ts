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

import shell from 'shelljs';
import { promisify } from 'util';
import config from './config.js';
import rushlib from '@microsoft/rush-lib';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify<string, { silent: boolean }, string>(shell.exec);

export type Folder = string;

const switchToArcadeLocation = async (): Promise<Folder> => {
	let arcadeLocation = config.get('arcadePath');
	if (!arcadeLocation) {
		arcadeLocation = path.join(__dirname, '../../../../../');
	}

	const rushConfiguration = rushlib.RushConfiguration.loadFromDefaultLocation({
		startingFolder: arcadeLocation,
	});

	const moduleConfiguration = rushConfiguration.findProjectByShorthandName('@arcade/infrastructure');
	if (!moduleConfiguration) {
		throw new Error('Module @arcade/infrastructure does not exist');
	}
	shell.cd(moduleConfiguration.projectFolder);
	return moduleConfiguration.projectFolder;
};

export { execAsync, switchToArcadeLocation };

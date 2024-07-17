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

import * as dotenv from 'dotenv';
import path from 'path';

export const initializeConfig = (pathToRoot: string, print = true): void => {
	dotenv.config({
		/*
		* Semgrep issue https://sg.run/OPqk
		* Ignore reason: This path is not being specified by user
		*/
		// nosemgrep
		path: path.join(pathToRoot, 'local.env'),
		debug: true,
	});

	if (print) {
		printConfig();
	}
};

export const printConfig = () => {
	console.log('==================== Config: ==================== ');
	Object.entries(process.env)
		.filter(([k]) => k.startsWith('ARCADE_'))
		.sort((a, b) => a[0].localeCompare(b[0]))
		.forEach(([key, value]) => {
			console.log(`\t${key}: ${value}`);
		});
	console.log('================================================= ');
};

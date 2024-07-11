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

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 30_000,
		exclude: ['**/node_modules/**', '.history', 'dist'],

		globals: true,

		////// none of these work:
		// testTimeout: 600000,
		hookTimeout: 60_000,
		// teardownTimeout: 600000,

		// onConsoleLog(log: string, type: 'stdout' | 'stderr'): false | void {
		// 	console.log('log in test: ', log);
		// 	if (log === 'message from third party library' && type === 'stdout') {
		// 		return false;
		// 	}
		// },
	},
});

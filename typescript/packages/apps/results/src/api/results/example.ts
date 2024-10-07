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

import { Result, ResultList } from './schemas.js';

export const resultResourceExample: Result = {
	regionId: '01j8sbj1bjwwtv7482rnrdxtqg',
	id: '01j8seqvy55xy4k4p51nz976zh',
	createdAt: '2024-09-27T09:59:39.352Z',
	startDateTime: '2024-09-22T09:59:32.518Z',
	endDateTime: '2024-09-27T09:59:32.518Z',
	engineType: 'aws-batch',
	status: 'succeeded',
	executionId: '2128c070-04ad-4476-8450-42d53b5954b4',
	updatedAt: '2024-09-27T10:01:08.091Z',
	message: 'Essential container in task exited',
};

export const resultListResourceExample: ResultList = {
	results: [resultResourceExample],
	pagination: {
		count: 20,
	},
};

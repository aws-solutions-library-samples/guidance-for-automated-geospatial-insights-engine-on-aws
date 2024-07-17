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

import { Result, ResultList } from "./schemas.js";

export const resultListResourceExample: ResultList = {
	"results": [
		{
			"regionId": "01hwvwmm5d2crn4xx8k0s0a61z",
			"id": "01hwy44p6yjpvkdx4c9g675h55",
			"createdAt": "2024-05-03T02:22:16.932Z",
			"engineType": "aws-batch",
			"status": "succeeded",
			"executionId": "56e998fb-8437-4bdb-b378-703481fdee6c",
			"updatedAt": "2024-05-03T02:23:31.334Z",
			"message": "Essential container in task exited"
		}
	],
	"pagination": {
		"count": 20
	}
}

export const resultResourceExample: Result = {
	"regionId": "01hwvwmm5d2crn4xx8k0s0a61z",
	"id": "01hwy44p6yjpvkdx4c9g675h55",
	"createdAt": "2024-05-03T02:22:16.932Z",
	"engineType": "aws-batch",
	"status": "succeeded",
	"executionId": "56e998fb-8437-4bdb-b378-703481fdee6c",
	"updatedAt": "2024-05-03T02:23:31.334Z",
	"message": "Essential container in task exited"
}

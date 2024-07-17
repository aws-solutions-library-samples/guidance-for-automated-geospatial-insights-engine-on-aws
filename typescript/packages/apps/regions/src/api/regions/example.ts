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

import { CreateRegion, EditRegion, Region, RegionList } from './schemas.js';

export const regionPostRequestExample: CreateRegion = {
	name: 'Abshire Harvest',
	processingConfig: {
		scheduleExpression: 'rate(5 days)',
		scheduleExpressionTimezone: 'Australia/Perth',
		mode: 'scheduled',
	}
};

export const regionPatchRequestExample1: EditRegion = regionPostRequestExample;
export const regionPatchRequestExample2: EditRegion = {
	processingConfig: {
		mode: 'scheduled',
		scheduleExpression: 'rate(5 days)',
		scheduleExpressionTimezone: 'Australia/Perth',
		priority: 'high'
	},
	tags: {
		tier: 'GOLD',
	},
};

/**
 * Example after initial creation
 */
export const regionResourceExample1: Region = {
	id: '76ghytgt5',
	groupId: 'sjduwydjd',
	...regionPostRequestExample,
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	totalArea: 100,
	totalPolygons: 2
};

export const regionResourceExample2: Region = {
	id: '0980yht42',
	groupId: 'sjduwydjd',
	name: 'Barrows Meadows',
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	updatedAt: '2022-08-12T07:34:23.132Z',
	updatedBy: 'someoneelse@somewhere.com',
	totalArea: 100,
	totalPolygons: 2,
	processingConfig: {
		scheduleExpression: 'rate(5 days)',
		scheduleExpressionTimezone: 'Australia/Perth',
		mode: 'scheduled',
	}
};

export const regionResourceExample3: Region = {
	id: 'rrwth876d',
	groupId: 'sjduwydjd',
	name: 'Bashirian Paddock',
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	totalArea: 100,
	totalPolygons: 2,
	processingConfig: {
		mode: 'disabled',
	}
};

export const regionListResource: RegionList = {
	regions: [regionResourceExample1, regionResourceExample2, regionResourceExample3],
	pagination: {
		token: regionResourceExample1.id,
		count: 3,
	},
};

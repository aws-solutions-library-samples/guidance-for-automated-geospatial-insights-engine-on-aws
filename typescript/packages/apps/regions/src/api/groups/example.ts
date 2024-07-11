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

import { CreateGroup, EditGroup, Group, GroupList } from './schemas.js';

export const groupPostRequestExample: CreateGroup = {
	name: 'Berkshire & West LLC',
};

export const groupPatchRequestExample1: EditGroup = groupPostRequestExample;
export const groupPatchRequestExample2: EditGroup = {
	tags: {
		tier: 'GOLD',
	},
};

/**
 * Example after initial creation
 */
export const groupResourceExample1: Group = {
	id: '03d66e78d',
	...groupPostRequestExample,
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	totalArea: 100,
	totalRegions: 2
};

export const groupResourceExample2: Group = {
	id: 'jduuye683',
	name: 'Withom Holdings',
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	updatedAt: '2022-08-12T07:34:23.132Z',
	updatedBy: 'someoneelse@somewhere.com',
	totalArea: 100,
	totalRegions: 2
};

export const groupResourceExample3: Group = {
	id: 'jf836sd23',
	name: 'Boondock Manor',
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	totalArea: 100,
	totalRegions: 2
};

export const groupListResource: GroupList = {
	groups: [groupResourceExample1, groupResourceExample2, groupResourceExample3],
	pagination: {
		token: groupResourceExample1.id,
		count: 3,
	},
};

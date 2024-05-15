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

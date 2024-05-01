import { CreateState, EditState, State, StateList } from './schemas.js';

export const statePostRequestExample: CreateState = {
	timestamp: '2024-04-15T00:00:00.000Z',
	attributes: {
		estimatedYield: 1026,
	},
	tags: {
		plantedAt: '2024-04-15T00:00:00.000Z',
		crop: 'corn',
	},
};

export const statePatchRequestExample1: EditState = statePostRequestExample;
export const statePatchRequestExample2: EditState = {
	tags: {
		harvestedAt: '2024-10-02T00:00:00.000Z',
	},
};

/**
 * Example after initial creation
 */
export const stateResourceExample1: State = {
	id: '76ghytgt5',
	...statePostRequestExample,
	polygonId: 'jutdjshjdksk',
	regionId: 'eyhdksjdk8js',
	groupId: 'jsuueyhdjs8',
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
};

export const stateResourceExample2: State = {
	id: '0980yht42',
	polygonId: 'jutdjshjdksk',
	regionId: 'eyhdksjdk8js',
	groupId: 'jsuueyhdjs8',
	timestamp: '2023-04-11T00:00:00.000Z',
	attributes: {
		estimatedYield: 925,
	},
	tags: {
		plantedAt: '2023-04-11T00:00:00.000Z',
		harvestedAt: '2023-10-02T00:00:00.000Z',
		crop: 'corn',
	},
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	updatedAt: '2022-08-12T07:34:23.132Z',
	updatedBy: 'someoneelse@somewhere.com',
};

export const stateResourceExample3: State = {
	id: 'rrwth876d',
	polygonId: 'jutdjshjdksk',
	regionId: 'eyhdksjdk8js',
	groupId: 'jsuueyhdjs8',
	timestamp: '2022-04-11T00:00:00.000Z',
	attributes: {
		estimatedYield: 879,
	},
	tags: {
		plantedAt: '2022-04-11T00:00:00.000Z',
		harvestedAt: '2022-10-02T00:00:00.000Z',
		crop: 'corn',
	},
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
};

export const stateListResource: StateList = {
	states: [stateResourceExample1, stateResourceExample2, stateResourceExample3],
	pagination: {
		token: stateResourceExample1.id,
		count: 3,
	},
};

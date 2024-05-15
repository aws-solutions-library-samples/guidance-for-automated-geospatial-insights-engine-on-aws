import { CreateRegion, EditRegion, Region, RegionList } from './schemas.js';

export const regionPostRequestExample: CreateRegion = {
	name: 'Abshire Harvest',
	scheduleExpression: 'rate(5 days)',
	scheduleExpressionTimezone: 'Australia/Perth',
};

export const regionPatchRequestExample1: EditRegion = regionPostRequestExample;
export const regionPatchRequestExample2: EditRegion = {
	scheduleExpression: 'rate(5 days)',
	scheduleExpressionTimezone: 'Australia/Perth',
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
	totalPolygons: 2
};

export const regionResourceExample3: Region = {
	id: 'rrwth876d',
	groupId: 'sjduwydjd',
	name: 'Bashirian Paddock',
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	totalArea: 100,
	totalPolygons: 2
};

export const regionListResource: RegionList = {
	regions: [regionResourceExample1, regionResourceExample2, regionResourceExample3],
	pagination: {
		token: regionResourceExample1.id,
		count: 3,
	},
};

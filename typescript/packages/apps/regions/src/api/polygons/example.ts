import { CreatePolygon, EditPolygon, Polygon, PolygonList } from './schemas.js';

export const polygonPostRequestExample: CreatePolygon = {
	name: 'Field 1',
	boundary: [
		[-104.5079674, 39.9194752],
		[-104.4894065, 39.9193435],
		[-104.4893912, 39.9122295],
		[-104.5078877, 39.9123941],
		[-104.5079674, 39.9194752],
	],
};

export const polygonPatchRequestExample1: EditPolygon = polygonPostRequestExample;
export const polygonPatchRequestExample2: EditPolygon = {
	tags: {
		tier: 'GOLD',
	},
};

/**
 * Example after initial creation
 */
export const polygonResourceExample1: Polygon = {
	id: '76ghytgt5',
	...polygonPostRequestExample,
	regionId: 'htgdjajdhja',
	groupId: 'jsuueyhdjs8',
	area: 175,
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
};

export const polygonResourceExample2: Polygon = {
	id: '0980yht42',
	name: 'Field 2',
	regionId: 'htgdjajdhja',
	groupId: 'jsuueyhdjs8',
	boundary: [
		[-104.4895628, 39.9390518],
		[-104.492009, 39.938295],
		[-104.4926527, 39.9376369],
		[-104.494026, 39.9378015],
		[-104.4971159, 39.9367485],
		[-104.4993046, 39.9345767],
		[-104.4992188, 39.9332933],
		[-104.4999483, 39.931615],
		[-104.4996908, 39.926909],
		[-104.4895199, 39.9268103],
		[-104.4895628, 39.9390518],
	],
	area: 655,
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	updatedAt: '2022-08-12T07:34:23.132Z',
	updatedBy: 'someoneelse@somewhere.com',
};

export const polygonListResource: PolygonList = {
	polygons: [polygonResourceExample1, polygonResourceExample2],
	pagination: {
		token: polygonResourceExample1.id,
		count: 2,
	},
};

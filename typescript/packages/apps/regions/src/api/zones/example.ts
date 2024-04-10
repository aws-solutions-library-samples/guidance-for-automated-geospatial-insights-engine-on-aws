import { CreateZone, EditZone, Zone, ZoneList } from './schemas.js';

export const zonePostRequestExample: CreateZone = {
	name: 'Field 1',
	boundary: [
		{
			lat: 39.9194752,
			lon: -104.5079674,
		},
		{
			lat: 39.9193435,
			lon: -104.4894065,
		},
		{
			lat: 39.9122295,
			lon: -104.4893912,
		},
		{
			lat: 39.9123941,
			lon: -104.5078877,
		},
	],
};

export const zonePatchRequestExample1: EditZone = zonePostRequestExample;
export const zonePatchRequestExample2: EditZone = {
	tags: {
		tier: 'GOLD',
	},
};

/**
 * Example after initial creation
 */
export const zoneResourceExample1: Zone = {
	id: '76ghytgt5',
	...zonePostRequestExample,
	acres: 175,
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
};

export const zoneResourceExample2: Zone = {
	id: '0980yht42',
	name: 'Field 2',
	boundary: [
		{
			lat: 39.9390518,
			lon: -104.4895628,
		},
		{
			lat: 39.938295,
			lon: -104.492009,
		},
		{
			lat: 39.9376369,
			lon: -104.4926527,
		},
		{
			lat: 39.9378015,
			lon: -104.494026,
		},
		{
			lat: 39.9367485,
			lon: -104.4971159,
		},
		{
			lat: 39.9345767,
			lon: -104.4993046,
		},
		{
			lat: 39.9332933,
			lon: -104.4992188,
		},
		{
			lat: 39.931615,
			lon: -104.4999483,
		},
		{
			lat: 39.926909,
			lon: -104.4996908,
		},
		{
			lat: 39.9268103,
			lon: -104.4895199,
		},
	],
	acres: 655,
	createdAt: '2022-08-10T23:55:20.322Z',
	createdBy: 'someone@somewhere.com',
	updatedAt: '2022-08-12T07:34:23.132Z',
	updatedBy: 'someoneelse@somewhere.com',
};

export const zoneListResource: ZoneList = {
	zones: [zoneResourceExample1, zoneResourceExample2],
	pagination: {
		lastEvaluatedToken: zoneResourceExample1.id,
	},
};

import { afterEach, beforeEach, describe, test } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { createResource, deleteResource, getResource, listResources, teardownResources, updateResource } from './common.utils.js';
import { create_group_body } from './groups.data.js';
import { create_region_body } from './regions.data.js';
import {
	ZONES_INTEGRATION_TEST_TAG_KEY,
	ZONES_INTEGRATION_TEST_TAG_VALUE,
	create_zone_body,
	created_zone_resource,
	update_zone_body,
	updated_zone_resource,
} from './zones.data.js';

const TEST_PREFIX = 'regions module (zones): ';

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[ZONES_INTEGRATION_TEST_TAG_KEY]: ZONES_INTEGRATION_TEST_TAG_VALUE,
};

const expectZoneJsonLike = {
	...created_zone_resource,
	...{
		tags: {
			...created_zone_resource['tags'],
			...testTags,
		},
	},
};

const createGroup = async (): Promise<string> => {
	return await createResource('groups', {
		expectStatus: 201,
		withJson: create_group_body,
		withTags: testTags,
	}).returns('id');
};
const createRegion = async (groupId: string): Promise<string> => {
	return await createResource(
		'regions',
		{
			expectStatus: 201,
			withJson: create_region_body,
			withTags: testTags,
		},
		'groups',
		groupId
	).returns('id');
};
const teardown = async () => {
	await teardownResources('states', ZONES_INTEGRATION_TEST_TAG_KEY, ZONES_INTEGRATION_TEST_TAG_VALUE, { latestOnly: false });
	await teardownResources('zones', ZONES_INTEGRATION_TEST_TAG_KEY, ZONES_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('regions', ZONES_INTEGRATION_TEST_TAG_KEY, ZONES_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('groups', ZONES_INTEGRATION_TEST_TAG_KEY, ZONES_INTEGRATION_TEST_TAG_VALUE);
};

describe(TEST_PREFIX + 'creating zones', () => {
	let regionId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		regionId = await createRegion(groupId);
	});

	afterEach(async () => {
		await teardown();
	});

	test('creating a zone - invalid parent region', async () => {
		await createResource(
			'zones',
			{
				withJson: create_zone_body,
				withTags: testTags,
				expectStatus: 404,
			},
			'regions',
			'does-not-exist'
		).toss();
	});

	test('creating a zone - missing name', async () => {
		await createResource(
			'zones',
			{
				withJson: {},
				expectStatus: 400,
			},
			'regions',
			regionId
		).toss();
	});

	test('creating a zone - happy path', async () => {
		await createResource(
			'zones',
			{
				withJson: create_zone_body,
				withTags: testTags,
				expectJsonLike: expectZoneJsonLike,
				expectStatus: 201,
			},
			'regions',
			regionId
		).toss();
	});

	// TODO: test that area calculated correctly
});

describe(TEST_PREFIX + 'retrieving zones', () => {
	let zoneId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		zoneId = await createResource(
			'zones',
			{
				withJson: create_zone_body,
				withTags: testTags,
				expectJsonLike: expectZoneJsonLike,
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('retrieving a zone - happy path', async () => {
		await getResource('zones', {
			id: zoneId,
			expectJsonLike: expectZoneJsonLike,
			expectStatus: 200,
		}).toss();
	});

	test('retrieving a zone - not found', async () => {
		await getResource('zones', {
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating zones', () => {
	let zoneId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		zoneId = await createResource(
			'zones',
			{
				withJson: create_zone_body,
				withTags: testTags,
				expectJsonLike: expectZoneJsonLike,
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('updating a zone - happy path', async () => {
		await updateResource('zones', {
			id: zoneId,
			withJson: update_zone_body,
			expectJsonLike: {
				...updated_zone_resource,
				...{
					tags: {
						...updated_zone_resource['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	test('updating a zone - not found', async () => {
		await updateResource('zones', {
			id: 'does-not-exist',
			withJson: update_zone_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a zone - invalid request', async () => {
		await updateResource('zones', {
			id: zoneId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing zones', () => {
	let groupId: string, region1Id: string, region2Id: string, region3Id: string;
	beforeEach(async () => {
		groupId = await createGroup();
		region1Id = await createResource(
			'regions',
			{
				withJson: {
					...create_region_body,
					name: 'pagination-region-1',
				},
				withTags: testTags,
				expectStatus: 201,
			},
			'groups',
			groupId
		).returns('id');

		await createResource(
			'zones',
			{
				withJson: {
					...create_zone_body,
					name: 'pagination-zone-1',
				},
				withTags: testTags,
				expectStatus: 201,
			},
			'regions',
			region1Id
		).toss();

		region2Id = await createResource(
			'regions',
			{
				withJson: {
					...create_region_body,
					name: 'pagination-region-2',
				},
				withTags: testTags,
				expectStatus: 201,
			},
			'groups',
			groupId
		).returns('id');

		await createResource(
			'zones',
			{
				withJson: {
					...create_zone_body,
					name: 'pagination-zone-2',
				},
				withTags: testTags,
				expectStatus: 201,
			},
			'regions',
			region2Id
		).toss();

		region3Id = await createResource(
			'regions',
			{
				withJson: {
					...create_region_body,
					name: 'pagination-region-3',
				},
				withTags: testTags,
				expectStatus: 201,
			},
			'groups',
			groupId
		).returns('id');

		await createResource(
			'zones',
			{
				withJson: {
					...create_zone_body,
					name: 'pagination-zone-3',
				},
				withTags: testTags,
				expectStatus: 201,
			},
			'regions',
			region3Id
		).toss();
	});

	afterEach(async () => {
		await teardown();
	});

	// TODO: test the different filtering options

	test('listing zones - pagination', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('zones', {
			withCount: 2,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 2,
			expectJsonLike: {
				zones: [
					{
						...expectZoneJsonLike,
						regionId: region1Id,
						name: 'pagination-zone-1',
					},
					{
						...expectZoneJsonLike,
						regionId: region2Id,
						name: 'pagination-zone-2',
					},
				],
				pagination: {
					count: 2,
					token: PAGINATION_TOKEN_PATTERN,
				},
			},
			expectStatus: 200,
		}).returns('pagination.token');

		// test pagination. Second page should return requested remaining 1
		await listResources('zones', {
			withCount: 2,
			withToken: token,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 1,
			expectJsonLike: {
				zones: [
					{
						...expectZoneJsonLike,
						regionId: region3Id,
						name: 'pagination-zone-3',
					},
				],
				pagination: {
					count: 2,
				},
			},
			expectStatus: 200,
		}).toss();
	});
});

describe(TEST_PREFIX + 'deleting zones', () => {
	let zoneId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		zoneId = await createResource(
			'zones',
			{
				withJson: create_zone_body,
				withTags: testTags,
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('deleting zones - happy path', async () => {
		await deleteResource('zones', {
			id: zoneId,
			expectStatus: 204,
		}).toss();
	});

	// TODO: test unable to delete zone if it has states

	// TODO: test able to delete zone with states if override provided
});

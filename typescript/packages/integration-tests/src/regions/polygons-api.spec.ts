import { afterEach, beforeEach, describe, test } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { createResource, deleteResource, getResource, listResources, teardownResources, updateResource } from './common.utils.js';
import { create_group_body } from './groups.data.js';
import { create_region_body } from './regions.data.js';
import {
	POLYGONS_INTEGRATION_TEST_TAG_KEY,
	POLYGONS_INTEGRATION_TEST_TAG_VALUE,
	create_polygon_body,
	created_polygon_resource,
	update_polygon_body,
	updated_polygon_resource,
} from './polygons.data.js';

const TEST_PREFIX = 'regions module (polygons): ';

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[POLYGONS_INTEGRATION_TEST_TAG_KEY]: POLYGONS_INTEGRATION_TEST_TAG_VALUE,
};

const expectPolygonJsonLike = {
	...created_polygon_resource,
	...{
		tags: {
			...created_polygon_resource['tags'],
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
	await teardownResources('states', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE, { latestOnly: false });
	await teardownResources('polygons', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('regions', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('groups', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE);
};

describe(TEST_PREFIX + 'creating polygons', () => {
	let regionId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		regionId = await createRegion(groupId);
	});

	afterEach(async () => {
		await teardown();
	});

	test('creating a polygon - invalid parent region', async () => {
		await createResource(
			'polygons',
			{
				withJson: create_polygon_body,
				withTags: testTags,
				expectStatus: 404,
			},
			'regions',
			'does-not-exist'
		).toss();
	});

	test('creating a polygon - missing name', async () => {
		await createResource(
			'polygons',
			{
				withJson: {},
				expectStatus: 400,
			},
			'regions',
			regionId
		).toss();
	});

	test('creating a polygon - happy path', async () => {
		await createResource(
			'polygons',
			{
				withJson: create_polygon_body,
				withTags: testTags,
				expectJsonLike: expectPolygonJsonLike,
				expectStatus: 201,
			},
			'regions',
			regionId
		).toss();
	});

	// TODO: test that area calculated correctly
});

describe(TEST_PREFIX + 'retrieving polygons', () => {
	let polygonId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		polygonId = await createResource(
			'polygons',
			{
				withJson: create_polygon_body,
				withTags: testTags,
				expectJsonLike: expectPolygonJsonLike,
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('retrieving a polygon - happy path', async () => {
		await getResource('polygons', {
			id: polygonId,
			expectJsonLike: expectPolygonJsonLike,
			expectStatus: 200,
		}).toss();
	});

	test('retrieving a polygon - not found', async () => {
		await getResource('polygons', {
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating polygons', () => {
	let polygonId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		polygonId = await createResource(
			'polygons',
			{
				withJson: create_polygon_body,
				withTags: testTags,
				expectJsonLike: expectPolygonJsonLike,
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('updating a polygon - happy path', async () => {
		await updateResource('polygons', {
			id: polygonId,
			withJson: update_polygon_body,
			expectJsonLike: {
				...updated_polygon_resource,
				...{
					tags: {
						...updated_polygon_resource['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	test('updating a polygon - not found', async () => {
		await updateResource('polygons', {
			id: 'does-not-exist',
			withJson: update_polygon_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a polygon - invalid request', async () => {
		await updateResource('polygons', {
			id: polygonId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing polygons', () => {
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
			'polygons',
			{
				withJson: {
					...create_polygon_body,
					name: 'pagination-polygon-1',
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
			'polygons',
			{
				withJson: {
					...create_polygon_body,
					name: 'pagination-polygon-2',
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
			'polygons',
			{
				withJson: {
					...create_polygon_body,
					name: 'pagination-polygon-3',
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

	test('listing polygons - pagination', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('polygons', {
			withCount: 2,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 2,
			expectJsonLike: {
				polygons: [
					{
						...expectPolygonJsonLike,
						regionId: region1Id,
						name: 'pagination-polygon-1',
					},
					{
						...expectPolygonJsonLike,
						regionId: region2Id,
						name: 'pagination-polygon-2',
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
		await listResources('polygons', {
			withCount: 2,
			withToken: token,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 1,
			expectJsonLike: {
				polygons: [
					{
						...expectPolygonJsonLike,
						regionId: region3Id,
						name: 'pagination-polygon-3',
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

describe(TEST_PREFIX + 'deleting polygons', () => {
	let polygonId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		polygonId = await createResource(
			'polygons',
			{
				withJson: create_polygon_body,
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

	test('deleting polygons - happy path', async () => {
		await deleteResource('polygons', {
			id: polygonId,
			expectStatus: 204,
		}).toss();
	});

	// TODO: test unable to delete polygon if it has states

	// TODO: test able to delete polygon with states if override provided
});

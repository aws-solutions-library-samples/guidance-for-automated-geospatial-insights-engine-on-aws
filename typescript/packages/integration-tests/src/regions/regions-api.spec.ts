import { afterEach, beforeEach, describe, test } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { createResource, deleteResource, getResource, listResources, teardownResources, updateResource } from './common.utils.js';
import { create_group_body } from './groups.data.js';
import {
	REGIONS_INTEGRATION_TEST_TAG_KEY,
	REGIONS_INTEGRATION_TEST_TAG_VALUE,
	create_region_body,
	created_region_resource,
	update_region_body,
	updated_region_resource,
} from './regions.data.js';

const TEST_PREFIX = 'regions module (regions): ';

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[REGIONS_INTEGRATION_TEST_TAG_KEY]: REGIONS_INTEGRATION_TEST_TAG_VALUE,
};

const expectRegionJsonLike = {
	...created_region_resource,
	...{
		tags: {
			...created_region_resource['tags'],
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

const teardown = async () => {
	await teardownResources('polygons', REGIONS_INTEGRATION_TEST_TAG_KEY, REGIONS_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('regions', REGIONS_INTEGRATION_TEST_TAG_KEY, REGIONS_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('groups', REGIONS_INTEGRATION_TEST_TAG_KEY, REGIONS_INTEGRATION_TEST_TAG_VALUE);
};

describe(TEST_PREFIX + 'creating regions', () => {
	let groupId: string;
	beforeEach(async () => {
		groupId = await createGroup();
	});

	afterEach(async () => {
		await teardown();
	});

	test('creating a region - invalid parent group', async () => {
		await createResource(
			'regions',
			{
				withJson: create_region_body,
				withTags: testTags,
				expectStatus: 404,
			},
			'groups',
			'does-not-exist'
		).toss();
	});

	test('creating a region - missing name', async () => {
		await createResource(
			'regions',
			{
				withJson: {},
				expectStatus: 400,
			},
			'groups',
			groupId
		).toss();
	});

	test('creating a region - happy path', async () => {
		await createResource(
			'regions',
			{
				withJson: create_region_body,
				withTags: testTags,
				expectJsonLike: expectRegionJsonLike,
				expectStatus: 201,
			},
			'groups',
			groupId
		).toss();
	});
});

describe(TEST_PREFIX + 'retrieving regions', () => {
	let regionId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		regionId = await createResource(
			'regions',
			{
				withJson: create_region_body,
				withTags: testTags,
				expectStatus: 201,
			},
			'groups',
			groupId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('retrieving a region - happy path', async () => {
		await getResource('regions', {
			id: regionId,
			expectJsonLike: expectRegionJsonLike,
			expectStatus: 200,
		}).toss();
	});

	test('retrieving a region - not found', async () => {
		await getResource('regions', {
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating regions', () => {
	let regionId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		regionId = await createResource(
			'regions',
			{
				withJson: create_region_body,
				withTags: testTags,
				expectJsonLike: expectRegionJsonLike,
				expectStatus: 201,
			},
			'groups',
			groupId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('updating a region - happy path', async () => {
		await updateResource('regions', {
			id: regionId,
			withJson: update_region_body,
			expectJsonLike: {
				...updated_region_resource,
				...{
					tags: {
						...updated_region_resource['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	test('updating a region - not found', async () => {
		await updateResource('regions', {
			id: 'does-not-exist',
			withJson: update_region_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a region - invalid request', async () => {
		await updateResource('regions', {
			id: regionId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing regions', () => {
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
	});

	afterEach(async () => {
		await teardown();
	});

	// TODO: test the different filtering options

	test('listing regions - pagination', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('regions', {
			withCount: 2,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 2,
			expectJsonLike: {
				regions: [
					{
						...expectRegionJsonLike,
						groupId,
						name: 'pagination-region-1',
					},
					{
						...expectRegionJsonLike,
						groupId,
						name: 'pagination-region-2',
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
		await listResources('regions', {
			withCount: 2,
			withToken: token,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 1,
			expectJsonLike: {
				regions: [
					{
						...expectRegionJsonLike,
						groupId,
						name: 'pagination-region-3',
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

describe(TEST_PREFIX + 'deleting regions', () => {
	let regionId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		regionId = await createResource(
			'regions',
			{
				withJson: create_region_body,
				withTags: testTags,
				expectStatus: 201,
			},
			'groups',
			groupId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('deleting regions - happy path', async () => {
		await deleteResource('regions', {
			id: regionId,
			expectStatus: 204,
		}).toss();
	});

	// TODO: test unable to delete region if it has polygons

	// TODO: test able to delete region with polygons if override provided
});

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
import { getAuthToken } from '../utils/auth.js';

const TEST_PREFIX = 'regions module (polygons): ';
const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[POLYGONS_INTEGRATION_TEST_TAG_KEY]: POLYGONS_INTEGRATION_TEST_TAG_VALUE,
};

const constructExpectedPolygonJson = (username: string): object => {
	return {
		...created_polygon_resource(username),
		...{
			tags: {
				...created_polygon_resource(username)['tags'],
				...testTags,
			},
		},
	};
};

const createGroup = async (idToken: string): Promise<string> => {
	return await createResource('groups', {
		withIdToken: idToken,
		expectStatus: 201,
		withJson: create_group_body,
		withTags: testTags,
	}).returns('id');
};
const createRegion = async (groupId: string, idToken: string): Promise<string> => {
	return await createResource(
		'regions',
		{
			withIdToken: idToken,
			expectStatus: 201,
			withJson: create_region_body,
			withTags: testTags,
		},
		'groups',
		groupId
	).returns('id');
};
const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await teardownResources('states', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE, idToken, { latestOnly: false });
	await teardownResources('polygons', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('regions', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('groups', POLYGONS_INTEGRATION_TEST_TAG_KEY, POLYGONS_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'creating polygons', () => {
	let regionId: string;
	let userToken;
	let expectPolygonJsonLike;
	beforeEach(async () => {
		expectPolygonJsonLike = constructExpectedPolygonJson(ADMIN_USERNAME);
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		regionId = await createRegion(groupId, userToken);
	});

	afterEach(async () => {
		await teardown();
	});

	test('creating a polygon - invalid parent region', async () => {
		await createResource(
			'polygons',
			{
				withIdToken: userToken,
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
				withIdToken: userToken,
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
				withIdToken: userToken,
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
	let userToken;
	let expectPolygonJsonLike;
	beforeEach(async () => {
		expectPolygonJsonLike = constructExpectedPolygonJson(ADMIN_USERNAME);
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		polygonId = await createResource(
			'polygons',
			{
				withIdToken: userToken,
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
			withIdToken: userToken,
			id: polygonId,
			expectJsonLike: expectPolygonJsonLike,
			expectStatus: 200,
		}).toss();
	});

	test('retrieving a polygon - not found', async () => {
		await getResource('polygons', {
			withIdToken: userToken,
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating polygons', () => {
	let polygonId: string;
	let userToken;
	const username = ADMIN_USERNAME;
	let expectPolygonJsonLike;
	let expectUpdatedPolygonJsonLike;

	beforeEach(async () => {
		expectPolygonJsonLike = constructExpectedPolygonJson(ADMIN_USERNAME);
		expectUpdatedPolygonJsonLike = updated_polygon_resource(username);
		userToken = await getAuthToken(username, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		polygonId = await createResource(
			'polygons',
			{
				withIdToken: userToken,
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
			withIdToken: userToken,
			id: polygonId,
			withJson: update_polygon_body,
			expectJsonLike: {
				...expectUpdatedPolygonJsonLike,
				...{
					tags: {
						...expectUpdatedPolygonJsonLike['tags'],
						...testTags,
					},
				},
				createdBy: username,
				updatedBy: username,
			},
			expectStatus: 200,
		}).toss();
	});

	test('updating a polygon - not found', async () => {
		await updateResource('polygons', {
			withIdToken: userToken,
			id: 'does-not-exist',
			withJson: update_polygon_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a polygon - invalid request', async () => {
		await updateResource('polygons', {
			withIdToken: userToken,
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
	let userToken;
	let expectPolygonJsonLike;
	beforeEach(async () => {
		expectPolygonJsonLike = constructExpectedPolygonJson(ADMIN_USERNAME);
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		region1Id = await createResource(
			'regions',
			{
				withIdToken: userToken,
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
				withIdToken: userToken,
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
				withIdToken: userToken,
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
				withIdToken: userToken,
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
				withIdToken: userToken,
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
				withIdToken: userToken,
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
			withIdToken: userToken,
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
			withIdToken: userToken,
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

// describe(TEST_PREFIX + 'deleting polygons', () => {
// 	let polygonId: string;
// 	let userToken;
// 	beforeEach(async () => {
// 		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
// 		const groupId = await createGroup(userToken);
// 		const regionId = await createRegion(groupId, userToken);
// 		polygonId = await createResource(
// 			'polygons',
// 			{
// 				withIdToken: userToken,
// 				withJson: create_polygon_body,
// 				withTags: testTags,
// 				expectStatus: 201,
// 			},
// 			'regions',
// 			regionId
// 		).returns('id');
// 	});

// 	afterEach(async () => {
// 		await teardown();
// 	});

// 	test('deleting polygons - happy path', async () => {
// 		await deleteResource('polygons', {
// 			withIdToken: userToken,
// 			id: polygonId,
// 			expectStatus: 204,
// 		}).toss();
// 	});

// 	// TODO: test unable to delete polygon if it has states

// 	// TODO: test able to delete polygon with states if override provided
// });

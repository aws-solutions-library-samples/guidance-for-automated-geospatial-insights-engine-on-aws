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

import { afterEach, beforeEach, describe, test } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { create_group_body } from './groups.data.js';
import {
	create_region_body,
	created_region_resource,
	REGIONS_INTEGRATION_TEST_TAG_KEY,
	REGIONS_INTEGRATION_TEST_TAG_VALUE,
	update_region_body,
	updated_region_resource,
} from './regions.data.js';
import { getAuthToken } from '../utils/auth.js';
import { createResourcesMethodForModules } from "../utils/common.utils.js";

const TEST_PREFIX = 'regions module (regions): ';
const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];


const { createResource, deleteResource, getResource, listResources, teardownResources, updateResource, waitForGetResource } = createResourcesMethodForModules('regions');

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[REGIONS_INTEGRATION_TEST_TAG_KEY]: REGIONS_INTEGRATION_TEST_TAG_VALUE,
};
const constructExpectedRegionJson = (username: string) => {
	return {
		...created_region_resource(username),
		...{
			tags: {
				...created_region_resource['tags'],
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

const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await teardownResources('polygons', REGIONS_INTEGRATION_TEST_TAG_KEY, REGIONS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('regions', REGIONS_INTEGRATION_TEST_TAG_KEY, REGIONS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('groups', REGIONS_INTEGRATION_TEST_TAG_KEY, REGIONS_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'creating regions', () => {
	let groupId: string;
	let userToken;
	let expectRegionJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectRegionJsonLike = constructExpectedRegionJson(ADMIN_USERNAME);
		groupId = await createGroup(userToken);
	});

	afterEach(async () => {
		await teardown();
	});

	test('creating a region - invalid parent group', async () => {
		await createResource(
			'regions',
			{
				withIdToken: userToken,
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
				withIdToken: userToken,
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
				withIdToken: userToken,
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
	let userToken: string;
	let expectRegionJsonLike: object;
	let groupId: string;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectRegionJsonLike = constructExpectedRegionJson(ADMIN_USERNAME);
		groupId = await createGroup(userToken);
		regionId = await createResource(
			'regions',
			{
				withIdToken: userToken,
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
			withIdToken: userToken,
			id: regionId,
			expectJsonLike: expectRegionJsonLike,
			expectStatus: 200,
		}).toss();

		await waitForGetResource('groups', {
			expectStatus: 200,
			id: groupId,
			withIdToken: userToken,
			expectJsonLike: {
				totalArea: 0,
				totalRegions: 1
			}
		})

	});

	test('retrieving a region - not found', async () => {
		await getResource('regions', {
			withIdToken: userToken,
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating regions', () => {
	let regionId: string;
	let userToken;
	let expectRegionJsonLike;
	const username = ADMIN_USERNAME;
	beforeEach(async () => {
		userToken = await getAuthToken(username, ADMIN_PASSWORD);
		expectRegionJsonLike = constructExpectedRegionJson(username);
		const groupId = await createGroup(userToken);
		regionId = await createResource(
			'regions',
			{
				withIdToken: userToken,
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
			withIdToken: userToken,
			id: regionId,
			withJson: update_region_body,
			expectJsonLike: {
				...updated_region_resource(username),
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
			withIdToken: userToken,
			id: 'does-not-exist',
			withJson: update_region_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a region - invalid request', async () => {
		await updateResource('regions', {
			withIdToken: userToken,
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
	let userToken;
	let expectRegionJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectRegionJsonLike = constructExpectedRegionJson(ADMIN_USERNAME);
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
	});

	afterEach(async () => {
		await teardown();
	});

	// TODO: test the different filtering options
	test('listing regions - pagination', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('regions', {
			withIdToken: userToken,
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
			withIdToken: userToken,
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

		await waitForGetResource('groups', {
			expectStatus: 200,
			id: groupId,
			withIdToken: userToken,
			expectJsonLike: {
				totalArea: 0,
				totalRegions: 3
			}
		})
	});
});

describe(TEST_PREFIX + 'deleting regions', () => {
	let regionId: string;
	let userToken: string;
	let groupId: string;

	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		regionId = await createResource(
			'regions',
			{
				withIdToken: userToken,
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
		await waitForGetResource('groups', {
			expectStatus: 200,
			id: groupId,
			withIdToken: userToken,
			expectJsonLike: {
				totalArea: 0,
				totalRegions: 1
			}
		})

		await deleteResource('regions', {
			withIdToken: userToken,
			id: regionId,
			expectStatus: 204,
		}).toss();

		// verify that the region is removed from the parent group
		await waitForGetResource('groups', {
			expectStatus: 200,
			id: groupId,
			withIdToken: userToken,
			expectJsonLike: {
				totalArea: 0,
				totalRegions: 0
			}
		})
	});

	// TODO: test unable to delete region if it has polygons

	// TODO: test able to delete region with polygons if override provided
});

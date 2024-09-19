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

import { State } from '@agie/regions';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { create_group_body } from './groups.data.js';
import { create_region_body } from './regions.data.js';
import {
	create_state_body,
	created_state_resource,
	STATES_INTEGRATION_TEST_TAG_KEY,
	STATES_INTEGRATION_TEST_TAG_VALUE,
	update_state_body,
	updated_state_resource,
} from './states.data.js';
import { create_polygon_body } from './polygons.data.js';
import { getAuthToken } from '../utils/auth.js';
import { createResourcesMethodForModules } from "../utils/common.utils.js";

const TEST_PREFIX = 'regions module (states): ';
const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[STATES_INTEGRATION_TEST_TAG_KEY]: STATES_INTEGRATION_TEST_TAG_VALUE,
};
const { createResource, deleteResource, getResource, listResources, teardownResources, updateResource } = createResourcesMethodForModules('regions');

const constructStateJson = (username: string): object => {
	return {
		...created_state_resource(username),
		...{
			tags: {
				...created_state_resource(username)['tags'],
				...testTags,
			},
		},
	};
};

const createGroup = async (idToken: string): Promise<string> => {
	return await createResource('groups', {
		withIdToken: idToken,
		withJson: create_group_body,
		withTags: testTags,
		expectStatus: 201,
	}).returns('id');
};
const createRegion = async (groupId: string, idToken: string): Promise<string> => {
	return await createResource(
		'regions',
		{
			withIdToken: idToken,
			withJson: create_region_body,
			withTags: testTags,
			expectStatus: 201,
		},
		'groups',
		groupId
	).returns('id');
};
const createPolygon = async (regionId: string, idToken: string): Promise<string> => {
	return await createResource(
		'polygons',
		{
			withIdToken: idToken,
			withJson: create_polygon_body,
			withTags: testTags,
			expectStatus: 201,
		},
		'regions',
		regionId
	).returns('id');
};
const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await teardownResources('states', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE, idToken, { latestOnly: false });
	await teardownResources('polygons', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('regions', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('groups', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'creating states', () => {
	let polygonId: string;
	let userToken;
	let expectStateJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectStateJsonLike = constructStateJson(ADMIN_USERNAME);
		const groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		polygonId = await createPolygon(regionId, userToken);
	});

	afterEach(async () => {
		await teardown();
	});

	it('creating a state - invalid parent polygon', async () => {
		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: create_state_body,
				withTags: testTags,
				expectStatus: 404,
			},
			'polygons',
			'does-not-exist'
		).toss();
	});

	it('creating a state - missing timestamp', async () => {
		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {},
				expectStatus: 400,
			},
			'polygons',
			polygonId
		).toss();
	});

	it('creating a state - happy path', async () => {
		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: create_state_body,
				withTags: testTags,
				expectJsonLike: expectStateJsonLike,
				expectStatus: 201,
			},
			'polygons',
			polygonId
		).returns('id');
	});
});

describe(
	TEST_PREFIX + 'creating states updates polygon current state',
	() => {
		let polygonId: string;
		let userToken;
		let expectStateJsonLike;
		beforeEach(async () => {
			expectStateJsonLike = constructStateJson(ADMIN_USERNAME);
			userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
			const groupId = await createGroup(userToken);
			const regionId = await createRegion(groupId, userToken);
			polygonId = await createPolygon(regionId, userToken);
		});

		afterEach(async () => {
			await teardown();
		});

		it('updates polygon current state', async () => {
			// create the initial state
			const firstStateId = await createResource(
				'states',
				{
					withIdToken: userToken,
					withJson: {
						...create_state_body,
						timestamp: '2021-01-01T00:00:00Z',
					},
					expectJsonLike: {
						...expectStateJsonLike,
						timestamp: '2021-01-01T00:00:00Z',
					},
					expectStatus: 201,
				},
				'polygons',
				polygonId
			).returns('id');

			// ensure its parent polygon has this as its current state
			let currentState: State = await getResource('polygons', {
				withIdToken: userToken,
				id: polygonId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(firstStateId);

			// create a second state that should supersede the first
			const secondStateId = await createResource(
				'states',
				{
					withIdToken: userToken,
					withJson: {
						...create_state_body,
						timestamp: '2023-01-01T00:00:00Z',
					},
					expectJsonLike: {
						...expectStateJsonLike,
						timestamp: '2023-01-01T00:00:00Z',
					},
					expectStatus: 201,
				},
				'polygons',
				polygonId
			).returns('id');

			// ensure its parent polygon has been updated to this as the current state
			currentState = await getResource('polygons', {
				withIdToken: userToken,
				id: polygonId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(secondStateId);

			// create a third state which is older than the second therefore should not supersede it
			const thirdStateId = await createResource(
				'states',
				{
					withIdToken: userToken,
					withJson: {
						...create_state_body,
						timestamp: '2022-01-01T00:00:00Z',
					},
					expectJsonLike: {
						...expectStateJsonLike,
						timestamp: '2022-01-01T00:00:00Z',
					},
					expectStatus: 201,
				},
				'polygons',
				polygonId
			).returns('id');

			// ensure its parent polygon still references the second state
			currentState = await getResource('polygons', {
				withIdToken: userToken,
				id: polygonId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(secondStateId);

			// delete the second state
			await deleteResource('states', {
				withIdToken: userToken,
				id: secondStateId,
				expectStatus: 204,
			});

			// ensure its parent polygon now references the third state due to the second being removed
			currentState = await getResource('polygons', {
				withIdToken: userToken,
				id: polygonId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(thirdStateId);
		});
	},
	10_000
);

describe(TEST_PREFIX + 'retrieving states', () => {
	let stateId: string;
	let userToken;
	let expectStateJsonLike;
	beforeEach(async () => {
		expectStateJsonLike = constructStateJson(ADMIN_USERNAME);
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		const polygonId = await createPolygon(regionId, userToken);
		stateId = await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: create_state_body,
				withTags: testTags,
				expectJsonLike: expectStateJsonLike,
				expectStatus: 201,
			},
			'polygons',
			polygonId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	it('retrieving a state - happy path', async () => {
		await getResource('states', {
			withIdToken: userToken,
			id: stateId,
			expectJsonLike: expectStateJsonLike,
			expectStatus: 200,
		}).toss();
	});

	it('retrieving a state - not found', async () => {
		await getResource('states', {
			withIdToken: userToken,
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating states', () => {
	let stateId: string;
	let userToken;
	let expectStateJsonLike;
	let expectStateUpdateJsonLike;
	beforeEach(async () => {
		expectStateJsonLike = constructStateJson(ADMIN_USERNAME);
		expectStateUpdateJsonLike = updated_state_resource(ADMIN_USERNAME);
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		const polygonId = await createPolygon(regionId, userToken);
		stateId = await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: create_state_body,
				withTags: testTags,
				expectJsonLike: expectStateJsonLike,
				expectStatus: 201,
			},
			'polygons',
			polygonId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	it('updating a state - happy path', async () => {
		await updateResource('states', {
			withIdToken: userToken,
			id: stateId,
			withJson: update_state_body,
			expectJsonLike: {
				...expectStateUpdateJsonLike,
				...{
					tags: {
						...expectStateUpdateJsonLike['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	it('updating a state - not found', async () => {
		await updateResource('states', {
			withIdToken: userToken,
			id: 'does-not-exist',
			withJson: update_state_body,
			expectStatus: 404,
		}).toss();
	});

	it('updating a state - invalid request', async () => {
		await updateResource('states', {
			withIdToken: userToken,
			id: stateId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing states', () => {
	// need to have multiple polygons, as by design only latest states are returned by default when listing
	let groupId: string;
	let polygon1Id: string, polygon2Id: string, polygon3Id: string;
	let userToken;
	let expectStateJsonLike;
	beforeEach(async () => {
		expectStateJsonLike = constructStateJson(ADMIN_USERNAME);
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		polygon1Id = await createResource(
			'polygons',
			{
				withIdToken: userToken,
				withJson: {
					...create_polygon_body,
					name: 'pagination-polygon-1',
				},
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');

		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {
					...create_state_body,
					timestamp: '2021-01-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'polygons',
			polygon1Id
		).toss();

		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {
					...create_state_body,
					timestamp: '2021-02-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'polygons',
			polygon1Id
		).toss();

		polygon2Id = await createResource(
			'polygons',
			{
				withIdToken: userToken,
				expectStatus: 201,
				withJson: {
					...create_polygon_body,
					name: 'pagination-polygon-2',
				},
			},
			'regions',
			regionId
		).returns('id');

		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {
					...create_state_body,
					timestamp: '2022-01-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'polygons',
			polygon2Id
		).toss();

		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {
					...create_state_body,
					timestamp: '2022-02-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'polygons',
			polygon2Id
		).toss();

		polygon3Id = await createResource(
			'polygons',
			{
				withIdToken: userToken,
				expectStatus: 201,
				withJson: {
					...create_polygon_body,
					name: 'pagination-polygon-3',
				},
			},
			'regions',
			regionId
		).returns('id');

		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {
					...create_state_body,
					timestamp: '2023-01-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'polygons',
			polygon3Id
		).toss();

		await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: {
					...create_state_body,
					timestamp: '2023-02-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'polygons',
			polygon3Id
		).toss();
	});

	afterEach(async () => {
		await teardown();
	});

	// TODO: test the different filtering options

	it('pagination - latest only', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('states', {
			withIdToken: userToken,
			withCount: 2,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 2,
			expectJsonLike: {
				states: [
					{
						...expectStateJsonLike,
						polygonId: polygon1Id,
						timestamp: '2021-02-01T00:00:00Z',
					},
					{
						...expectStateJsonLike,
						polygonId: polygon2Id,
						timestamp: '2022-02-01T00:00:00Z',
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
		await listResources('states', {
			withIdToken: userToken,
			withCount: 2,
			withToken: token,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 1,
			expectJsonLike: {
				states: [
					{
						...expectStateJsonLike,
						polygonId: polygon3Id,
						timestamp: '2023-02-01T00:00:00Z',
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

describe(TEST_PREFIX + 'deleting states', () => {
	let stateId: string;
	let userToken;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const groupId = await createGroup(userToken);
		const regionId = await createRegion(groupId, userToken);
		const polygonId = await createPolygon(regionId, userToken);
		stateId = await createResource(
			'states',
			{
				withIdToken: userToken,
				withJson: create_state_body,
				expectStatus: 201,
			},
			'polygons',
			polygonId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	it('deleting states - happy path', async () => {
		await deleteResource('states', {
			withIdToken: userToken,
			id: stateId,
			expectStatus: 204,
		}).toss();
	});
});

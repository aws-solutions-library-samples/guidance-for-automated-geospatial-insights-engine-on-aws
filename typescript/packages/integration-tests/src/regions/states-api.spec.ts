import { State } from '@arcade/regions';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { createResource, deleteResource, getResource, listResources, teardownResources, updateResource } from './common.utils.js';
import { create_group_body } from './groups.data.js';
import { create_region_body } from './regions.data.js';
import {
	STATES_INTEGRATION_TEST_TAG_KEY,
	STATES_INTEGRATION_TEST_TAG_VALUE,
	create_state_body,
	created_state_resource,
	update_state_body,
	updated_state_resource,
} from './states.data.js';
import { create_zone_body } from './zones.data.js';

const TEST_PREFIX = 'regions module (states): ';

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[STATES_INTEGRATION_TEST_TAG_KEY]: STATES_INTEGRATION_TEST_TAG_VALUE,
};

const expectStateJsonLike = {
	...created_state_resource,
	...{
		tags: {
			...created_state_resource['tags'],
			...testTags,
		},
	},
};

const createGroup = async (): Promise<string> => {
	return await createResource('groups', {
		withJson: create_group_body,
		withTags: testTags,
		expectStatus: 201,
	}).returns('id');
};
const createRegion = async (groupId: string): Promise<string> => {
	return await createResource(
		'regions',
		{
			withJson: create_region_body,
			withTags: testTags,
			expectStatus: 201,
		},
		'groups',
		groupId
	).returns('id');
};
const createZone = async (regionId: string): Promise<string> => {
	return await createResource(
		'zones',
		{
			withJson: create_zone_body,
			withTags: testTags,
			expectStatus: 201,
		},
		'regions',
		regionId
	).returns('id');
};
const teardown = async () => {
	await teardownResources('states', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE, { latestOnly: false });
	await teardownResources('zones', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('regions', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('groups', STATES_INTEGRATION_TEST_TAG_KEY, STATES_INTEGRATION_TEST_TAG_VALUE);
};

describe(TEST_PREFIX + 'creating states', () => {
	let zoneId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		zoneId = await createZone(regionId);
	});

	afterEach(async () => {
		await teardown();
	});

	it('creating a state - invalid parent zone', async () => {
		await createResource(
			'states',
			{
				withJson: create_state_body,
				withTags: testTags,
				expectStatus: 404,
			},
			'zones',
			'does-not-exist'
		).toss();
	});

	it('creating a state - missing timestamp', async () => {
		await createResource(
			'states',
			{
				withJson: {},
				expectStatus: 400,
			},
			'zones',
			zoneId
		).toss();
	});

	it('creating a state - happy path', async () => {
		await createResource(
			'states',
			{
				withJson: create_state_body,
				withTags: testTags,
				expectJsonLike: expectStateJsonLike,
				expectStatus: 201,
			},
			'zones',
			zoneId
		).returns('id');
	});
});

describe(
	TEST_PREFIX + 'creating states updates zone current state',
	() => {
		let zoneId: string;
		beforeEach(async () => {
			const groupId = await createGroup();
			const regionId = await createRegion(groupId);
			zoneId = await createZone(regionId);
		});

		afterEach(async () => {
			await teardown();
		});

		it('updates zone current state', async () => {
			// create the initial state
			const firstStateId = await createResource(
				'states',
				{
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
				'zones',
				zoneId
			).returns('id');

			// ensure its parent zone has this as its current state
			let currentState: State = await getResource('zones', {
				id: zoneId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(firstStateId);

			// create a second state that should supersede the first
			const secondStateId = await createResource(
				'states',
				{
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
				'zones',
				zoneId
			).returns('id');

			// ensure its parent zone has been updated to this as the current state
			currentState = await getResource('zones', {
				id: zoneId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(secondStateId);

			// create a third state which is older than the second therefore should not supersede it
			const thirdStateId = await createResource(
				'states',
				{
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
				'zones',
				zoneId
			).returns('id');

			// ensure its parent zone still references the second state
			currentState = await getResource('zones', {
				id: zoneId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(secondStateId);

			// delete the second state
			await deleteResource('states', {
				id: secondStateId,
				expectStatus: 204,
			});

			// ensure its parent zone now references the third state due to the second being removed
			currentState = await getResource('zones', {
				id: zoneId,
				expectStatus: 200,
			}).returns('state');
			expect(currentState.id).toStrictEqual(thirdStateId);
		});
	},
	10_000
);

describe(TEST_PREFIX + 'retrieving states', () => {
	let stateId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		const zoneId = await createZone(regionId);
		stateId = await createResource(
			'states',
			{
				withJson: create_state_body,
				withTags: testTags,
				expectJsonLike: expectStateJsonLike,
				expectStatus: 201,
			},
			'zones',
			zoneId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	it('retrieving a state - happy path', async () => {
		await getResource('states', {
			id: stateId,
			expectJsonLike: expectStateJsonLike,
			expectStatus: 200,
		}).toss();
	});

	it('retrieving a state - not found', async () => {
		await getResource('states', {
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating states', () => {
	let stateId: string;
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		const zoneId = await createZone(regionId);
		stateId = await createResource(
			'states',
			{
				withJson: create_state_body,
				withTags: testTags,
				expectJsonLike: expectStateJsonLike,
				expectStatus: 201,
			},
			'zones',
			zoneId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	it('updating a state - happy path', async () => {
		await updateResource('states', {
			id: stateId,
			withJson: update_state_body,
			expectJsonLike: {
				...updated_state_resource,
				...{
					tags: {
						...updated_state_resource['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	it('updating a state - not found', async () => {
		await updateResource('states', {
			id: 'does-not-exist',
			withJson: update_state_body,
			expectStatus: 404,
		}).toss();
	});

	it('updating a state - invalid request', async () => {
		await updateResource('states', {
			id: stateId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing states', () => {
	// need to have multiple zones, as by design only latest states are returned by default when listing
	let groupId: string;
	let zone1Id: string, zone2Id: string, zone3Id: string;

	beforeEach(async () => {
		groupId = await createGroup();
		const regionId = await createRegion(groupId);
		zone1Id = await createResource(
			'zones',
			{
				withJson: {
					...create_zone_body,
					name: 'pagination-zone-1',
				},
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');

		await createResource(
			'states',
			{
				withJson: {
					...create_state_body,
					timestamp: '2021-01-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'zones',
			zone1Id
		).toss();

		await createResource(
			'states',
			{
				withJson: {
					...create_state_body,
					timestamp: '2021-02-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'zones',
			zone1Id
		).toss();

		zone2Id = await createResource(
			'zones',
			{
				expectStatus: 201,
				withJson: {
					...create_zone_body,
					name: 'pagination-zone-2',
				},
			},
			'regions',
			regionId
		).returns('id');

		await createResource(
			'states',
			{
				withJson: {
					...create_state_body,
					timestamp: '2022-01-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'zones',
			zone2Id
		).toss();

		await createResource(
			'states',
			{
				withJson: {
					...create_state_body,
					timestamp: '2022-02-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'zones',
			zone2Id
		).toss();

		zone3Id = await createResource(
			'zones',
			{
				expectStatus: 201,
				withJson: {
					...create_zone_body,
					name: 'pagination-zone-3',
				},
			},
			'regions',
			regionId
		).returns('id');

		await createResource(
			'states',
			{
				withJson: {
					...create_state_body,
					timestamp: '2023-01-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'zones',
			zone3Id
		).toss();

		await createResource(
			'states',
			{
				withJson: {
					...create_state_body,
					timestamp: '2023-02-01T00:00:00Z',
				},
				expectStatus: 201,
			},
			'zones',
			zone3Id
		).toss();
	});

	afterEach(async () => {
		await teardown();
	});

	// TODO: test the different filtering options

	it('pagination - latest only', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('states', {
			withCount: 2,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 2,
			expectJsonLike: {
				states: [
					{
						...expectStateJsonLike,
						zoneId: zone1Id,
						timestamp: '2021-02-01T00:00:00Z',
					},
					{
						...expectStateJsonLike,
						zoneId: zone2Id,
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
			withCount: 2,
			withToken: token,
			withGroupId: groupId,
			withTags: testTags,
			expectCount: 1,
			expectJsonLike: {
				states: [
					{
						...expectStateJsonLike,
						zoneId: zone3Id,
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
	beforeEach(async () => {
		const groupId = await createGroup();
		const regionId = await createRegion(groupId);
		const zoneId = await createZone(regionId);
		stateId = await createResource(
			'states',
			{
				withJson: create_state_body,
				expectStatus: 201,
			},
			'zones',
			zoneId
		).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	it('deleting states - happy path', async () => {
		await deleteResource('states', {
			id: stateId,
			expectStatus: 204,
		}).toss();
	});
});

import { afterEach, beforeEach, describe, test } from 'vitest';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { createResource, deleteResource, getResource, listResources, teardownResources, updateResource } from './common.utils.js';
import {
	GROUPS_INTEGRATION_TEST_TAG_KEY,
	GROUPS_INTEGRATION_TEST_TAG_VALUE,
	create_group_body,
	created_group_resource,
	update_group_body,
	updated_group_resource,
} from './groups.data.js';

const TEST_PREFIX = 'regions module (groups): ';

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[GROUPS_INTEGRATION_TEST_TAG_KEY]: GROUPS_INTEGRATION_TEST_TAG_VALUE,
};

const expectGroupJsonLike = {
	...created_group_resource,
	...{
		tags: {
			...created_group_resource['tags'],
			...testTags,
		},
	},
};

const teardown = async () => {
	await teardownResources('regions', GROUPS_INTEGRATION_TEST_TAG_KEY, GROUPS_INTEGRATION_TEST_TAG_VALUE);
	await teardownResources('groups', GROUPS_INTEGRATION_TEST_TAG_KEY, GROUPS_INTEGRATION_TEST_TAG_VALUE);
};

describe(TEST_PREFIX + 'creating groups', () => {
	afterEach(async () => {
		await teardown();
	});

	test('creating a group - missing name', async () => {
		await createResource('groups', {
			withJson: {},
			expectStatus: 400,
		}).toss();
	});

	test('creating a group - happy path', async () => {
		await createResource('groups', {
			withJson: create_group_body,
			withTags: testTags,
			expectJsonLike: expectGroupJsonLike,
			expectStatus: 201,
		}).toss();
	});
});

describe(TEST_PREFIX + 'retrieving groups', () => {
	let groupId: string;
	beforeEach(async () => {
		groupId = await createResource('groups', {
			withJson: create_group_body,
			withTags: testTags,
			expectStatus: 201,
		}).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('retrieving a group - happy path', async () => {
		await getResource('groups', {
			id: groupId,
			expectJsonLike: expectGroupJsonLike,
			expectStatus: 200,
		}).toss();
	});

	test('retrieving a group - not found', async () => {
		await getResource('groups', {
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating groups', () => {
	let groupId: string;
	beforeEach(async () => {
		groupId = await createResource('groups', {
			withJson: create_group_body,
			withTags: testTags,
			expectJsonLike: expectGroupJsonLike,
			expectStatus: 201,
		}).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('updating a group - happy path', async () => {
		await updateResource('groups', {
			id: groupId,
			withJson: update_group_body,
			expectJsonLike: {
				...updated_group_resource,
				...{
					tags: {
						...updated_group_resource['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	test('updating a group - not found', async () => {
		await updateResource('groups', {
			id: 'does-not-exist',
			withJson: update_group_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a group - invalid request', async () => {
		await updateResource('groups', {
			id: groupId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing groups', () => {
	beforeEach(async () => {
		await createResource('groups', {
			withJson: {
				...create_group_body,
				name: 'pagination-group-1',
			},
			withTags: testTags,
			expectStatus: 201,
		}).toss();

		await createResource('groups', {
			withJson: {
				...create_group_body,
				name: 'pagination-group-2',
			},
			withTags: testTags,
			expectStatus: 201,
		}).toss();

		await createResource('groups', {
			withJson: {
				...create_group_body,
				name: 'pagination-group-3',
			},
			withTags: testTags,
			expectStatus: 201,
		}).toss();
	});

	afterEach(async () => {
		await teardown();
	});

	// TODO: test the different filtering options

	test('listing groups - pagination', async () => {
		// test pagination. First page should return requested count of 2 along with pagination details
		const token = await listResources('groups', {
			withCount: 2,
			withTags: testTags,
			expectCount: 2,
			expectJsonLike: {
				groups: [
					{
						...expectGroupJsonLike,
						name: 'pagination-group-1',
					},
					{
						...expectGroupJsonLike,
						name: 'pagination-group-2',
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
		await listResources('groups', {
			withCount: 2,
			withToken: token,
			withTags: testTags,
			expectCount: 1,
			expectJsonLike: {
				groups: [
					{
						...expectGroupJsonLike,
						name: 'pagination-group-3',
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

describe(TEST_PREFIX + 'deleting groups', () => {
	let groupId: string;
	beforeEach(async () => {
		groupId = await createResource('groups', {
			withJson: create_group_body,
			withTags: testTags,
			expectStatus: 201,
		}).returns('id');
	});

	afterEach(async () => {
		await teardown();
	});

	test('deleting groups - happy path', async () => {
		await deleteResource('groups', {
			id: groupId,
			expectStatus: 204,
		}).toss();
	});

	// TODO: test unable to delete group if it has regions

	// TODO: test able to delete group with regions if override provided
});

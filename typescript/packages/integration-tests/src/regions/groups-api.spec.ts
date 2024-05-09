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
import { getAuthToken } from '../utils/auth.js';

const TEST_PREFIX = 'regions module (groups): ';

// tag everything created in this test with the same tags, so can be teared down cleanly
const testTags = {
	[GROUPS_INTEGRATION_TEST_TAG_KEY]: GROUPS_INTEGRATION_TEST_TAG_VALUE,
};

const constructCreateGroupJson = (username: string) => {
	return {
		...created_group_resource(username),
		...{
			tags: {
				...created_group_resource(username)['tags'],
				...testTags,
			},
		},
	};
};

const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await teardownResources('regions', GROUPS_INTEGRATION_TEST_TAG_KEY, GROUPS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await teardownResources('groups', GROUPS_INTEGRATION_TEST_TAG_KEY, GROUPS_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'creating groups', () => {
	let userToken;
	let expectGroupJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectGroupJsonLike = constructCreateGroupJson(ADMIN_USERNAME);
	});
	afterEach(async () => {
		await teardown();
	});

	test('creating a group - missing name', async () => {
		await createResource('groups', {
			withJson: {},
			withIdToken: userToken,
			expectStatus: 400,
		}).toss();
	});

	test('creating a group - happy path', async () => {
		await createResource('groups', {
			withJson: create_group_body,
			withIdToken: userToken,
			withTags: testTags,
			expectJsonLike: expectGroupJsonLike,
			expectStatus: 201,
		}).toss();
	});
});

describe(TEST_PREFIX + 'retrieving groups', () => {
	let groupId: string;
	let userToken;
	let expectGroupJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectGroupJsonLike = constructCreateGroupJson(ADMIN_USERNAME);
		groupId = await createResource('groups', {
			withIdToken: userToken,
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
			withIdToken: userToken,
			id: groupId,
			expectJsonLike: expectGroupJsonLike,
			expectStatus: 200,
		}).toss();
	});

	test('retrieving a group - not found', async () => {
		await getResource('groups', {
			withIdToken: userToken,
			id: 'does-not-exist',
			expectStatus: 404,
		}).toss();
	});
});

describe(TEST_PREFIX + 'updating groups', () => {
	let groupId: string;
	let userToken;
	let expectGroupJsonLike;
	let expectUpdatedGroupJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectGroupJsonLike = constructCreateGroupJson(ADMIN_USERNAME);
		expectUpdatedGroupJsonLike = updated_group_resource(ADMIN_USERNAME);
		groupId = await createResource('groups', {
			withIdToken: userToken,
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
			withIdToken: userToken,
			id: groupId,
			withJson: update_group_body,
			expectJsonLike: {
				...expectUpdatedGroupJsonLike,
				...{
					tags: {
						...expectUpdatedGroupJsonLike['tags'],
						...testTags,
					},
				},
			},
			expectStatus: 200,
		}).toss();
	});

	test('updating a group - not found', async () => {
		await updateResource('groups', {
			withIdToken: userToken,
			id: 'does-not-exist',
			withJson: update_group_body,
			expectStatus: 404,
		}).toss();
	});

	test('updating a group - invalid request', async () => {
		await updateResource('groups', {
			withIdToken: userToken,
			id: groupId,
			withJson: {
				invalid_attribute: true,
			},
			expectStatus: 400,
		}).toss();
	});
});

describe(TEST_PREFIX + 'listing groups', () => {
	let userToken;
	let expectGroupJsonLike;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		expectGroupJsonLike = constructCreateGroupJson(ADMIN_USERNAME);
		await createResource('groups', {
			withIdToken: userToken,
			withJson: {
				...create_group_body,
				name: 'pagination-group-1',
			},
			withTags: testTags,
			expectStatus: 201,
		}).toss();

		await createResource('groups', {
			withIdToken: userToken,
			withJson: {
				...create_group_body,
				name: 'pagination-group-2',
			},
			withTags: testTags,
			expectStatus: 201,
		}).toss();

		await createResource('groups', {
			withIdToken: userToken,
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
			withIdToken: userToken,
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
			withIdToken: userToken,
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
	let userToken;
	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createResource('groups', {
			withIdToken: userToken,
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
			withIdToken: userToken,
			id: groupId,
			expectStatus: 204,
		}).toss();
	});

	// TODO: test unable to delete group if it has regions

	// TODO: test able to delete group with regions if override provided
});

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

import { create_group_body } from "../regions/groups.data.js";
import { create_region_body } from "../regions/regions.data.js";
import { afterAll, beforeAll, describe, test } from "vitest";
import { getAuthToken } from "../utils/auth.js";
import { NOTIFICATIONS_INTEGRATION_TEST_TAG_KEY, NOTIFICATIONS_INTEGRATION_TEST_TAG_VALUE } from "./notifications.data.js";
import { PAGINATION_TOKEN_PATTERN } from "../utils/regex.js";
import { createResourcesMethodForModules } from "../utils/common.utils.js";

const TEST_PREFIX = 'notifications module (notifications): ';
const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

const regions = createResourcesMethodForModules('regions');
const notifications = createResourcesMethodForModules('notifications');

const testTags = { [NOTIFICATIONS_INTEGRATION_TEST_TAG_KEY]: NOTIFICATIONS_INTEGRATION_TEST_TAG_VALUE }

const createGroup = async (idToken: string): Promise<string> => {
	return await regions.createResource('groups', {
		withIdToken: idToken,
		withJson: create_group_body,
		withTags: testTags,
		expectStatus: 201,
	}).returns('id');
};
const createRegion = async (groupId: string, idToken: string): Promise<string> => {
	return await regions.createResource(
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

const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await regions.teardownResources('regions', NOTIFICATIONS_INTEGRATION_TEST_TAG_KEY, NOTIFICATIONS_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('groups', NOTIFICATIONS_INTEGRATION_TEST_TAG_KEY, NOTIFICATIONS_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'creating notification', () => {
	let userToken: string, regionId: string, groupId: string, subscriptionId: string;

	beforeAll(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		regionId = await createRegion(groupId, userToken);
	});

	test('creating a subscription - happy path', async () => {
		subscriptionId = await notifications.createResource(
			`subscriptions`,
			{
				withIdToken: userToken,
				withJson: {},
				withTags: testTags,
				expectStatus: 201,
			},
			'regions',
			regionId
		).returns('id');
	});

	test('creating a subscription - invalid region', async () => {
		const subscriptionId = await notifications.createResource(
			`subscriptions`,
			{
				withIdToken: userToken,
				withJson: {},
				withTags: testTags,
				expectStatus: 404,
			},
			'regions',
			'invalid-region-id'
		).toss();
	});


	test('creating a subscription - subscription already exists', async () => {
		const subscriptionId = await notifications.createResource(
			`subscriptions`,
			{
				withIdToken: userToken,
				withJson: {},
				withTags: testTags,
				expectStatus: 409,
			},
			'regions',
			regionId
		).toss();
	});

	afterAll(async () => {
		await notifications.deleteResource('subscriptions', { withIdToken: userToken, expectStatus: 204, id: subscriptionId });
		await teardown();
	});

});

const createSubscription = async (regionId: string, userToken: string): Promise<string> => {
	return await notifications.createResource(
		`subscriptions`,
		{
			withIdToken: userToken,
			withJson: {},
			withTags: testTags,
			expectStatus: 201,
		},
		'regions',
		regionId
	).returns('id');
};
describe(TEST_PREFIX + 'listing notifications', () => {
	let userToken: string, region1Id: string, region2Id: string, region3Id: string, subscription1Id: string, subscription2Id: string, subscription3Id: string, groupId: string;

	beforeAll(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		groupId = await createGroup(userToken);
		region1Id = await createRegion(groupId, userToken);
		region2Id = await createRegion(groupId, userToken);
		region3Id = await createRegion(groupId, userToken);

		subscription1Id = await createSubscription(region1Id, userToken)
		subscription2Id = await createSubscription(region2Id, userToken)
		subscription3Id = await createSubscription(region3Id, userToken)
	});

	test('list subscriptions - happy path', async () => {
		await notifications.listResources(
			`subscriptions`,
			{
				withIdToken: userToken,
				expectJsonLike: {
					subscriptions: [
						{
							id: subscription1Id,
							regionId: region1Id
						},
						{
							id: subscription2Id,
							regionId: region2Id
						},
						{
							id: subscription3Id,
							regionId: region3Id
						}]
				},
				expectStatus: 200,
			}
		)
	});

	test('list subscriptions - with pagination', async () => {
		const { token } = await notifications.listResources(
			`subscriptions`,
			{
				withIdToken: userToken,
				withCount: 2,
				expectJsonLike: {
					pagination: {
						token: PAGINATION_TOKEN_PATTERN,
					},
					subscriptions: [
						{
							id: subscription1Id,
							regionId: region1Id
						},
						{
							id: subscription2Id,
							regionId: region2Id
						}]
				},
				expectStatus: 200,
			}
		).returns('pagination')

		await notifications.listResources(
			`subscriptions`,
			{
				withIdToken: userToken,
				withToken: token,
				withCount: 2,
				expectJsonLike: {
					subscriptions: [
						{
							id: subscription3Id,
							regionId: region3Id
						}
					]
				},
				expectStatus: 200,
			}
		).toss();
	});

	afterAll(async () => {
		await notifications.deleteResource('subscriptions', { withIdToken: userToken, expectStatus: 204, id: subscription1Id });
		await notifications.deleteResource('subscriptions', { withIdToken: userToken, expectStatus: 204, id: subscription2Id });
		await notifications.deleteResource('subscriptions', { withIdToken: userToken, expectStatus: 204, id: subscription3Id });
		await teardown();
	});
});

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

import { ResultResource } from '@agie/clients';
import { fromProcess } from '@aws-sdk/credential-providers';
import { Credentials } from 'aws4';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import pWaitFor from 'p-wait-for';
import { afterEach, beforeEach, describe, test } from 'vitest';
import { getAuthToken } from '../utils/auth.js';
import { createResourcesMethodForModules } from '../utils/common.utils.js';
import { ID_PATTERN, ISO8601_DATE_TIME_MS_PATTERN, UUID_PATTERN } from '../utils/regex.js';
import {
	create_group_body,
	create_polygon_body,
	create_region_body_without_schedule,
	create_state_body,
	SCHEDULER_INTEGRATION_TEST_TAG_KEY,
	SCHEDULER_INTEGRATION_TEST_TAG_VALUE,
} from './scheduler.data.js';

dayjs.extend(utc);

const TEST_PREFIX = 'scheduler module: ';

const ADMIN_USERNAME = process.env['ADMIN_USERNAME'];
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'];

// tag everything created in this test with the same tags, so can be torn down cleanly
const testTags = {
	[SCHEDULER_INTEGRATION_TEST_TAG_KEY]: SCHEDULER_INTEGRATION_TEST_TAG_VALUE,
};

const regions = createResourcesMethodForModules('regions');
const results = createResourcesMethodForModules('results');
const stacs = createResourcesMethodForModules('stac');
const teardown = async () => {
	const idToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	await regions.teardownResources('states', SCHEDULER_INTEGRATION_TEST_TAG_KEY, SCHEDULER_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('polygons', SCHEDULER_INTEGRATION_TEST_TAG_KEY, SCHEDULER_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('regions', SCHEDULER_INTEGRATION_TEST_TAG_KEY, SCHEDULER_INTEGRATION_TEST_TAG_VALUE, idToken);
	await regions.teardownResources('groups', SCHEDULER_INTEGRATION_TEST_TAG_KEY, SCHEDULER_INTEGRATION_TEST_TAG_VALUE, idToken);
};

describe(TEST_PREFIX + 'scheduler and engine modules integration', () => {
	let regionId: string, groupId: string, polygonId: string, stateId: string, userToken: string;
	let credentials: Credentials;

	beforeEach(async () => {
		userToken = await getAuthToken(ADMIN_USERNAME, ADMIN_PASSWORD);
		const { accessKeyId, secretAccessKey, sessionToken } = await fromProcess()();
		credentials = { accessKeyId, secretAccessKey, sessionToken };
		groupId = await createGroup(userToken);
		regionId = await createRegionWithoutSchedule(groupId, userToken);
		polygonId = await createPolygon(regionId, userToken);
		// verify that region stac collection is created
		await waitForStacCollection(credentials, `agie-region`, regionId);
		stateId = await createState(polygonId, userToken);
	});

	test('verify that scheduler is triggered to execute engine for polygons', { timeout: 5 * 60 * 6000 }, async () => {
		// update the region resource with schedule
		await updateRegionWithSchedule(regionId, userToken);
		// wait for successful engine execution
		const resultListResource = await waitForSuccessfulEngineExecution(regionId, userToken);

		// wait until the stac collection is published
		await waitForStacCollection(credentials, `agie-polygon`, `${resultListResource[0].id}_${polygonId}`);

		// ensure that results status is propagated to the region resource
		await regions.waitForGetResource('regions', {
			withIdToken: userToken,
			id: regionId,
			expectJsonLike: {
				attributes: {
					'agie:results:id': resultListResource[0].id,
					'agie:results:status': 'succeeded',
					'agie:results:message': 'Essential container in task exited',
					'agie:results:updatedAt': ISO8601_DATE_TIME_MS_PATTERN,
				},
			},
			expectStatus: 200,
		});
	});

	afterEach(async () => {
		await Promise.all([teardown()]);
	});
});

const waitForStacCollection = async (credentials: Credentials, collectionId: string, id: string): Promise<void> => {
	await pWaitFor(
		async (): Promise<any> => {
			try {
				await getStacItem(credentials, collectionId, id);
				return true;
			} catch (e) {
				if (e.message === 'HTTP status 404 !== 200') {
					return false;
				} else {
					throw e;
				}
			}
		},
		{ timeout: 10 * 1000, interval: 1000 }
	);
};

const waitForSuccessfulEngineExecution = async (regionId: string, userToken: string): Promise<ResultResource[]> => {
	let resultListResource: ResultResource[];
	await pWaitFor(
		async (): Promise<any> => {
			try {
				resultListResource = await results
					.listResources(`regions/${regionId}/results`, {
						withIdToken: userToken,
						expectJsonLike: {
							results: [
								{
									id: ID_PATTERN,
									status: 'succeeded',
									executionId: UUID_PATTERN,
								},
							],
						},
						expectStatus: 200,
					})
					.returns('results');
				return true;
			} catch (e) {
				const noResultError = `Json doesn't have 'array' with length '1' at '$.results' but found 'array' with length '0'`;
				const jobInQueuedStateError = `Json doesn't have value 'succeeded' at '$.results[0].status' but found 'queued'`;
				const jobInStartingStateError = `Json doesn't have value 'succeeded' at '$.results[0].status' but found 'starting'`;
				const jobInProgressStateError = `Json doesn't have value 'succeeded' at '$.results[0].status' but found 'inProgress'`;
				if ([noResultError, jobInProgressStateError, jobInQueuedStateError, jobInStartingStateError].includes(e.message)) {
					return false;
				} else {
					throw e;
				}
			}
		},
		{ timeout: 5 * 60000, interval: 10000 }
	);
	return resultListResource;
};

const getStacItem = async (credentials: Credentials, collectionId: string, itemId: string): Promise<any> => {
	await stacs
		.listResources(`collections/${collectionId}/items/${itemId}`, {
			withIAMCredentials: credentials,
			withContentHeader: 'application/geo+json; charset=utf-8',
			expectJsonLike: {
				id: itemId,
				type: 'Feature',
			},
			expectStatus: 200,
		})
		.toss();
};

const createGroup = async (idToken: string): Promise<string> => {
	return await regions
		.createResource('groups', {
			withIdToken: idToken,
			expectStatus: 201,
			withJson: create_group_body,
			withTags: testTags,
		})
		.returns('id');
};

const createRegionWithoutSchedule = async (groupId: string, idToken: string): Promise<string> => {
	return await regions
		.createResource(
			'regions',
			{
				withIdToken: idToken,
				expectStatus: 201,
				withJson: create_region_body_without_schedule,
				withTags: testTags,
			},
			'groups',
			groupId
		)
		.returns('id');
};

const createPolygon = async (regionId: string, idToken: string): Promise<string> => {
	return await regions
		.createResource(
			'polygons',
			{
				withIdToken: idToken,
				expectStatus: 201,
				withJson: create_polygon_body,
				withTags: testTags,
			},
			'regions',
			regionId
		)
		.returns('id');
};

const createState = async (polygonId: string, idToken: string): Promise<string> => {
	return await regions
		.createResource(
			'states',
			{
				withIdToken: idToken,
				withJson: create_state_body,
				withTags: testTags,
				expectStatus: 201,
			},
			'polygons',
			polygonId
		)
		.returns('id');
};

const updateRegionWithSchedule = async (regionId: string, idToken: string): Promise<void> => {
	const currentTime = new Date();
	const timeInOneMinute = new Date(currentTime.getTime() + 60000); // 60000 milliseconds = 1 minute
	await regions.updateResource(`regions`, {
		withIdToken: idToken,
		expectStatus: 200,
		id: regionId,
		withTags: testTags,
		withJson: {
			processingConfig: {
				scheduleExpression: `at(${dayjs(timeInOneMinute).local().format('YYYY-MM-DDThh:mm:ss')})`,
				scheduleExpressionTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				priority: 'high',
				mode: 'scheduled',
			},
		},
	});
};

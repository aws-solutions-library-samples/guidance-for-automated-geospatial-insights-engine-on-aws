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

import { Region, RegionsClient, ResultResource, ResultsClient, StacServerClient } from '@agie/clients';
import { StartJobRequest } from '@agie/events';
import { SendMessageBatchCommandInput, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import axios from 'axios';
import dayjs from 'dayjs';
import pino from 'pino';
import { ulid } from 'ulid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { JobsRepository } from './repository.js';
import { JobsService } from './service.js';

vi.mock('axios');
describe('JobService', () => {
	let underTest: JobsService;
	let mockSqsClient = mockClient(SQSClient);

	let mockRegionClient: MockProxy<RegionsClient> = mock<RegionsClient>();
	let mockResultsClient: MockProxy<ResultsClient> = mock<ResultsClient>();
	let mockStacServerClient: MockProxy<StacServerClient> = mock<StacServerClient>();
	let mockJobsRepository: MockProxy<JobsRepository> = mock<JobsRepository>();

	const mockContext = {
		authorizer: {
			claims: {
				email: 'results',
				'custom:role': '/|||reader',
			},
		},
	};

	const sentinelStacItemOne = {
		id: 'S2B_57VUJ_20240523_0_L2A',
		bbox: [155.1574545900154, 61.19587852251979, 157.18227983219822, 62.21985346668669],
		messageId: 'sqsMessageId1',
		geometry: {
			coordinates: [
				[
					[155.1574545900154, 61.19587852251979],
					[157.18227983219822, 61.19587852251979],
					[157.18227983219822, 62.21985346668669],
					[155.1574545900154, 62.21985346668669],
					[155.1574545900154, 61.19587852251979],
				],
			],
		},
		properties: {
			datetime: dayjs().toISOString(),
		},
	} as any;

	const sentinelStacItemTwo = {
		id: 'S2B_58VUJ_20240523_0_L2A',
		bbox: [155.1574545900154, 61.19587852251979, 157.18227983219822, 62.21985346668669],
		messageId: 'sqsMessageId2',
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[155.1177692, 61.2045656],
					[155.1971626, 61.2056405],
					[155.1957893, 61.1775155],
					[155.1198292, 61.1767707],
					[155.1177692, 61.2045656],
				],
			],
		},
		properties: {
			datetime: dayjs().toISOString(),
		},
	};

	const regionPartialMatch = {
		id: 'region1Id',
		bbox: [155.1438618, 61.1888099, 155.1773357, 61.1997281],
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[155.1438618, 61.1989424],
					[155.1773357, 61.1997281],
					[155.1755333, 61.1894717],
					[155.1450634, 61.1888099],
					[155.1438618, 61.1989424],
				],
			],
		},
	};

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';

		sentinelStacItemOne.properties.datetime = dayjs().toISOString();
		sentinelStacItemTwo.properties.datetime = dayjs().toISOString();

		// construct the underTest object
		underTest = new JobsService(
			logger,
			mockStacServerClient,
			mockRegionClient,
			mockResultsClient,
			mockSqsClient as unknown as SQSClient,
			'QUEUE_URL',
			'TEST_SENTINEL_API_URL',
			'TEST_SENTINEL_COLLECTION',
			mockJobsRepository
		);

		mockResultsClient.listResults.mockReset();
		mockResultsClient.listResults.mockResolvedValue({ results: [] });

		// reset sqs client
		mockSqsClient.reset();
		// reset RegionClient
		mockRegionClient.listGroups.mockReset();
		mockRegionClient.listGroups.mockResolvedValue({ groups: [{ id: 'group1' }] } as any);
		mockRegionClient.getRegionById.mockReset();
		mockRegionClient.getRegionById.mockResolvedValue({
			id: 'region1Id',
		} as Region);

		// reset JobsRepository
		mockJobsRepository.get.mockReset();
		mockJobsRepository.save.mockReset();

		// reset StacServerClient
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValue({
			features: [
				{
					id: 'region1Id',
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[156.4356136, 61.851938],
								[156.4426517, 61.8517761],
								[156.4420938, 61.8487998],
								[156.4362574, 61.8487391],
								[156.4328241, 61.8502171],
								[156.4356136, 61.851938],
							],
						],
					},
				},
			],
		} as any);
	});

	it('should push match regions task to engine queue - happy path', async () => {
		const failedMessageIds = await underTest.startJobOnRegionMatch([sentinelStacItemOne]);
		// verify that we only query regions that are both active and has on new scene configured
		expect(mockStacServerClient.search).toHaveBeenCalledWith({
			// verify that we only search in group_* collections
			collections: ['agie-region'],
			bbox: sentinelStacItemOne.bbox,
			query: {
				'agie:isActive': {
					eq: true,
				},
				'agie:processedOnNewScene': {
					eq: true,
				},
			},
		});

		// verify there is error message returned
		expect(failedMessageIds.length).toBe(0);
		// verify that we trigger the task by sending messages to sqs
		const sendMessagesRequest: SendMessageBatchCommandInput = mockSqsClient.calls()[0].args[0].input as any;
		expect(sendMessagesRequest.Entries).toHaveLength(1);
		// verify that we set the deduplication id to combination of region id and stac item processing date so we're not triggering redundant task for a region
		expect(sendMessagesRequest.Entries[0].MessageDeduplicationId).toBe('region1Id');
		// verify that we will query matched region in
		expect(mockRegionClient.getRegionById).toHaveBeenCalledWith('region1Id', mockContext);
		expect(mockJobsRepository.save).toHaveBeenCalledWith('region1Id', dayjs(sentinelStacItemOne.properties.datetime).startOf('day').toISOString());
	});

	it('should use previous result end date as start time of the current processing', async () => {
		const lastResultId = ulid().toLowerCase();
		const lastResultEndTime = dayjs().add(-6, 'day').toISOString();

		mockResultsClient.listResults.mockReset();
		mockResultsClient.listResults.mockResolvedValue({
			results: [
				{
					id: lastResultId,
					endDateTime: lastResultEndTime,
				} as ResultResource,
			],
		});

		await underTest.startJobOnRegionMatch([sentinelStacItemOne]);
		// verify that we trigger the task by sending messages to sqs
		const sendMessagesRequest: SendMessageBatchCommandInput = mockSqsClient.calls()[0].args[0].input as any;
		expect(sendMessagesRequest.Entries).toHaveLength(1);
		// verify that we set the deduplication id to combination of region id and stac item processing date so we're not triggering redundant task for a region
		expect(sendMessagesRequest.Entries[0].MessageDeduplicationId).toBe('region1Id');
		const message: StartJobRequest = JSON.parse(sendMessagesRequest.Entries[0].MessageBody);
		// verify that we set the start time as the previous result end time if exists
		expect(message.startDateTime).toBe(lastResultEndTime);
		expect(message.latestResultId).toBe(lastResultId);
		// verify that we will query matched region in
		expect(mockRegionClient.getRegionById).toHaveBeenCalledWith('region1Id', mockContext);
		expect(mockJobsRepository.save).toHaveBeenCalledWith('region1Id', dayjs(sentinelStacItemOne.properties.datetime).startOf('day').toISOString());
	});

	it('should handle partial match by querying sentinel API for overlapping images', async () => {
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValue({
			features: [regionPartialMatch],
		} as any);

		axios.post['mockResolvedValue']({
			data: {
				features: [sentinelStacItemOne, sentinelStacItemTwo],
			},
		});

		await underTest.startJobOnRegionMatch([sentinelStacItemOne]);
		// verify that we trigger the task by sending messages to sqs
		const sendMessagesRequest: SendMessageBatchCommandInput = mockSqsClient.calls()[0].args[0].input as any;
		expect(sendMessagesRequest.Entries).toHaveLength(1);
		// verify that we set the deduplication id to combination of region id and stac item processing date so we're not triggering redundant task for a region
		expect(sendMessagesRequest.Entries[0].MessageDeduplicationId).toBe('region1Id');
		// verify that we will query matched region in
		expect(mockRegionClient.getRegionById).toHaveBeenCalledWith('region1Id', mockContext);
	});

	it('should ignore region if stac item is older than 1 day', async () => {
		sentinelStacItemOne.properties.datetime = dayjs().add(-2, 'day').toISOString();
		await underTest.startJobOnRegionMatch([sentinelStacItemOne]);
		expect(mockStacServerClient.search).not.toHaveBeenCalled();
		expect(mockSqsClient.calls().length).toBe(0);
	});

	it('should ignore region if a processing had been done for the same day', async () => {
		mockJobsRepository.get.mockReset();
		mockJobsRepository.get.mockResolvedValue({ regionId: sentinelStacItemOne.id, scheduleDay: '' });

		await underTest.startJobOnRegionMatch([sentinelStacItemOne]);
		// verify that we only query regions that are both active and has on new scene configured
		expect(mockStacServerClient.search).toHaveBeenCalledWith({
			// verify that we only search in group_* collections
			collections: ['agie-region'],
			bbox: sentinelStacItemOne.bbox,
			query: {
				'agie:isActive': {
					eq: true,
				},
				'agie:processedOnNewScene': {
					eq: true,
				},
			},
		});

		expect(mockSqsClient.calls().length).toBe(0);
	});

	it('should ignore region if agie stac server does not return any match', async () => {
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValue({ features: [] } as any);
		await underTest.startJobOnRegionMatch([sentinelStacItemOne]);
		expect(mockSqsClient.calls().length).toBe(0);
	});

	it('should return error message ids if exception happened', async () => {
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValueOnce({ features: [] } as any);
		mockStacServerClient.search.mockRejectedValueOnce('error');
		const failedMessageIds = await underTest.startJobOnRegionMatch([sentinelStacItemOne, sentinelStacItemTwo]);
		expect(failedMessageIds.length).toBe(1);
		expect(failedMessageIds[0]).toBe(sentinelStacItemTwo.messageId);
	});
});

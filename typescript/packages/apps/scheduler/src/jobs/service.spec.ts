import { beforeEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import { JobsService } from "./service.js";
import { Region, RegionsClient, StacServerClient } from "@arcade/clients";
import { mock, MockProxy } from "vitest-mock-extended";
import { SendMessageBatchCommandInput, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from 'aws-sdk-client-mock';
import { StacItem } from "@arcade/events";
import axios from "axios";

vi.mock('axios')
describe('JobService', () => {

	let underTest: JobsService;
	let mockSqsClient = mockClient(SQSClient)
	let mockRegionClient: MockProxy<RegionsClient> = mock<RegionsClient>();
	let mockStacServerClient: MockProxy<StacServerClient> = mock<StacServerClient>();

	const mockContext = {
		authorizer: {
			claims: {
				email: 'results',
				'custom:role': '/|||reader',
			},
		},
	};

	const sentinelStacItemOne = {
		"id": "S2B_57VUJ_20240523_0_L2A",
		"bbox": [
			155.1574545900154,
			61.19587852251979,
			157.18227983219822,
			62.21985346668669
		],
		geometry: {
			"coordinates": [[
				[
					155.1574545900154,
					61.19587852251979
				],
				[
					157.18227983219822,
					61.19587852251979
				],
				[
					157.18227983219822,
					62.21985346668669
				],
				[
					155.1574545900154,
					62.21985346668669
				],
				[
					155.1574545900154,
					61.19587852251979
				]
			]]
		},
		"properties": {
			"datetime": "2024-05-23T01:19:40Z",

		}
	} as any as StacItem

	const sentinelStacItemTwo = {
		"id": "S2B_58VUJ_20240523_0_L2A",
		"bbox": [
			155.1574545900154,
			61.19587852251979,
			157.18227983219822,
			62.21985346668669
		],
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[
						155.1177692,
						61.2045656
					],
					[
						155.1971626,
						61.2056405
					],
					[
						155.1957893,
						61.1775155
					],
					[
						155.1198292,
						61.1767707
					],
					[
						155.1177692,
						61.2045656
					],
				]
			]
		},
		"properties": {
			"datetime": "2024-05-23T01:19:40Z",
		}
	}

	const regionPartialMatch = {
		id: 'region1Id',
		bbox: [
			155.1438618,
			61.1888099,
			155.1773357,
			61.1997281
		],
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[
						155.1438618,
						61.1989424
					],
					[
						155.1773357,
						61.1997281
					],
					[
						155.1755333,
						61.1894717
					],
					[
						155.1450634,
						61.1888099
					],

					[
						155.1438618,
						61.1989424
					],
				]
			]
		}
	}

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';

		// construct the underTest object
		underTest = new JobsService(logger,
			mockStacServerClient,
			mockRegionClient,
			mockSqsClient as unknown as SQSClient,
			'QUEUE_URL',
			'TEST_SENTINEL_API_URL',
			'TEST_SENTINEL_COLLECTION')

		// reset sqs client
		mockSqsClient.reset();
		// reset RegionClient
		mockRegionClient.listGroups.mockReset();
		mockRegionClient.listGroups.mockResolvedValue({ groups: [{ id: 'group1' }] } as any);
		mockRegionClient.getRegionById.mockReset();
		mockRegionClient.getRegionById.mockResolvedValue({
			id: 'region1Id'
		} as Region)
		// reset StacServerClient
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValue({
			features: [{
				id: 'region1Id',
				geometry: {
					type: "Polygon",
					coordinates: [[
						[
							156.4356136,
							61.851938
						],
						[
							156.4426517,
							61.8517761
						],
						[
							156.4420938,
							61.8487998
						],
						[
							156.4362574,
							61.8487391
						],
						[
							156.4328241,
							61.8502171
						],
						[
							156.4356136,
							61.851938
						]
					]]
				}
			}]
		} as any)
	})

	it('should push match regions task to engine queue - happy path', async () => {
		await underTest.startJobOnRegionMatch([sentinelStacItemOne])
		// verify that we only query regions that are both active and has on new scene configured
		expect(mockStacServerClient.search).toHaveBeenCalledWith({
			// verify that we only search in group_* collections
			collections: ['arcade-region'],
			"bbox": sentinelStacItemOne.bbox,
			"query": {
				"arcade:isActive": {
					"eq": true
				},
				"arcade:processedOnNewScene": {
					"eq": true
				}
			}
		})
		// verify that we trigger the task by sending messages to sqs
		const sendMessagesRequest: SendMessageBatchCommandInput = mockSqsClient.calls()[0].args[0].input as any;
		expect(sendMessagesRequest.Entries).toHaveLength(1);
		// verify that we set the deduplication id to combination of region id and stac item processing date so we're not triggering redundant task for a region
		expect(sendMessagesRequest.Entries[0].MessageDeduplicationId).toBe('region1Id');
		// verify that we will query matched region in
		expect(mockRegionClient.getRegionById).toHaveBeenCalledWith('region1Id', mockContext)
	});

	it('should handle partial match by querying sentinel API for overlapping images', async () => {
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValue({
			features: [regionPartialMatch]
		} as any)

		axios.post['mockResolvedValue']({
			data: {
				features: [
					sentinelStacItemOne,
					sentinelStacItemTwo
				]
			},
		})

		await underTest.startJobOnRegionMatch([sentinelStacItemOne])
		// verify that we trigger the task by sending messages to sqs
		const sendMessagesRequest: SendMessageBatchCommandInput = mockSqsClient.calls()[0].args[0].input as any;
		expect(sendMessagesRequest.Entries).toHaveLength(1);
		// verify that we set the deduplication id to combination of region id and stac item processing date so we're not triggering redundant task for a region
		expect(sendMessagesRequest.Entries[0].MessageDeduplicationId).toBe('region1Id');
		// verify that we will query matched region in
		expect(mockRegionClient.getRegionById).toHaveBeenCalledWith('region1Id', mockContext)
	});

	it('should ignore regions if arcade stac server does not return any match', async () => {
		mockStacServerClient.search.mockReset();
		mockStacServerClient.search.mockResolvedValue({ features: [] } as any);
		await underTest.startJobOnRegionMatch([sentinelStacItemOne])
		expect(mockSqsClient.calls().length).toBe(0);
	});

});

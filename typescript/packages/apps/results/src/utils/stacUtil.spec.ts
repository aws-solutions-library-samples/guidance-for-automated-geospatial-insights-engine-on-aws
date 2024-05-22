import { beforeEach, describe, expect, it } from "vitest";
import { StacUtil } from "./stacUtil.js";
import pino from "pino";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { MockProxy } from 'vitest-mock-extended';
import { RegionsClient } from "@arcade/clients";
import { RegionDetails } from "@arcade/events";

describe('StacUtil', () => {

	let underTest: StacUtil;
	let mockS3Client = mockClient(S3Client);
	let mockRegionsClient: MockProxy<RegionsClient>;

	const regionCreatedEvent: RegionDetails = {
		"id": "01hxr5q6wkt4xbhk7thrvq269d",
		"groupId": "01hxr5q5x80vvn71depzg9083k",
		"name": "test-region-1",
		"attributes": {
			"attr2": "attr-two",
			"attr1": "attr-one"
		},
		"createdAt": "2024-05-20T06:43:27.006Z",
		updatedAt: "2024-05-20T06:43:27.006Z",
		"createdBy": "arcadeTest@amazon.com",
		boundingBox: [
			-72.4483377,
			42.9027258,
			-72.4465191,
			42.9037868,
		],
		updatedBy: ""
	}

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';
		underTest = new StacUtil(logger, mockS3Client as unknown as S3Client, 'testBucketName', mockRegionsClient)
	})

	it('should assemble region stac item so we perform coordinates stac search for regions', async () => {
		const result = await underTest.constructRegionStacItem(regionCreatedEvent);
		expect(result).toEqual(
			{
				"id": "01hxr5q6wkt4xbhk7thrvq269d",
				"collection": "group_01hxr5q5x80vvn71depzg9083k",
				"type": "Feature",
				"stac_version": "1.0.0",
				"stac_extensions": [],
				"geometry": {
					"type": "Polygon",
					"coordinates": [
						[
							[
								-72.4483377,
								42.9027258
							],
							[
								-72.4465191,
								42.9027258
							],
							[
								-72.4465191,
								42.9037868
							],
							[
								-72.4483377,
								42.9037868
							],
							[
								-72.4483377,
								42.9027258
							]
						]
					]
				},
				"bbox": [
					-72.4483377,
					42.9027258,
					-72.4465191,
					42.9037868
				],
				"properties": {
					"createdAt": "2024-05-20T06:43:27.006Z",
					"datetime": "2024-05-20T06:43:27.006Z",
					"updatedAt": "2024-05-20T06:43:27.006Z",
				},
				"links": [],
				"assets": {}
			}
		)
	});

});

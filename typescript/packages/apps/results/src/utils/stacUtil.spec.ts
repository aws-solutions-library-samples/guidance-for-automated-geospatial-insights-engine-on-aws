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

import { beforeEach, describe, expect, it } from "vitest";
import { StacUtil } from "./stacUtil.js";
import pino from "pino";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { RegionResource } from "@arcade/events";

describe('StacUtil', () => {

	let underTest: StacUtil;
	let mockS3Client = mockClient(S3Client);

	const regionCreatedEvent: RegionResource = {
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
		updatedBy: "",
		processingConfig: {
			mode: "disabled",
		}
	}

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';
		underTest = new StacUtil(logger, mockS3Client as unknown as S3Client, 'testBucketName')
	})

	it('should assemble stac item for created region', async () => {
		const result = await underTest.constructRegionStacItem({ ...regionCreatedEvent, isActive: true });
		expect(result).toEqual(
			{
				"id": "01hxr5q6wkt4xbhk7thrvq269d",
				"collection": "arcade-region",
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
					"arcade:groupId": "01hxr5q5x80vvn71depzg9083k",
					"arcade:isActive": true,
					"arcade:processedOnNewScene": false,
					"createdAt": "2024-05-20T06:43:27.006Z",
					"datetime": "2024-05-20T06:43:27.006Z",
					"updatedAt": "2024-05-20T06:43:27.006Z",
				},
				"links": [],
				"assets": {}
			}
		)
	});

	it('should assemble stac item for deleted region', async () => {
		const result = await underTest.constructRegionStacItem({ ...regionCreatedEvent, isActive: false });
		expect(result).toEqual(
			{
				"id": "01hxr5q6wkt4xbhk7thrvq269d",
				"collection": "arcade-region",
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
					"arcade:groupId": "01hxr5q5x80vvn71depzg9083k",
					"arcade:isActive": false,
					"arcade:processedOnNewScene": false,
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

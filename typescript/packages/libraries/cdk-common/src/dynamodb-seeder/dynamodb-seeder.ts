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

import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Runtime, SingletonFunction } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CustomResource, Duration } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Seeds } from './seeds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DynamoDBSeederProps {
	readonly table: ITable;
	readonly seeds: Seeds;
	/**
	 * The function execution time (in seconds) after which Lambda terminates
	 * the function. Because the execution time affects cost, set this value
	 * based on the function's expected execution time.
	 *
	 * @default Duration.minutes(15)
	 */
	readonly timeout?: Duration;
}

export class DynamoDBSeeder extends Construct {
	constructor(scope: Construct, id: string, props: DynamoDBSeederProps) {
		super(scope, id);

		const seeds = props.seeds.bind(this);
		const seedsBucket = seeds.s3Location?.bucketName ? Bucket.fromBucketName(this, 'SeedsBucket', seeds.s3Location.bucketName) : undefined;

		const handler = new SingletonFunction(this, 'CustomResourceHandler', {
			uuid: 'Custom::DynamodbSeeder',
			runtime: Runtime.NODEJS_20_X,
			code: Code.fromAsset(path.join(__dirname, 'lambdas')),
			handler: 'index.handler',
			lambdaPurpose: 'Custom::DynamodbSeeder',
			timeout: props.timeout ?? Duration.minutes(15),
		});

		handler.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['dynamodb:BatchWriteItem'],
				resources: [props.table.tableArn],
			})
		);

		if (props.table.encryptionKey) {
			handler.addToRolePolicy(
				new PolicyStatement({
					effect: Effect.ALLOW,
					actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey', 'kms:CreateGrant'],
					resources: [props.table.encryptionKey.keyArn],
				})
			);
		}

		if (seedsBucket) {
			const objectKey = seeds.s3Location?.objectKey ?? '*';

			handler.addToRolePolicy(
				new PolicyStatement({
					effect: Effect.ALLOW,
					actions: ['s3:GetObject'],
					resources: [seedsBucket.arnForObjects(objectKey)],
				})
			);
		}

		new CustomResource(this, 'CustomResource', {
			serviceToken: handler.functionArn,
			resourceType: 'Custom::DynamodbSeeder',
			properties: {
				TableName: props.table.tableName,
				Seeds: {
					InlineSeeds: seeds.inlineSeeds,
					S3Bucket: seeds.s3Location && seeds.s3Location.bucketName,
					S3Key: seeds.s3Location && seeds.s3Location.objectKey,
					S3ObjectVersion: seeds.s3Location && seeds.s3Location.objectVersion,
				},
			},
		});
	}
}

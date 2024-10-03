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

import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export const bucketNameParameter = (environment: string) => `/agie/${environment}/shared/bucketName`;
export const bucketArnParameter = (environment: string) => `/agie/${environment}/shared/bucketArn`;

export interface S3ConstructProperties {
	environment: string;
	bucketName: string;
	cdkResourceNamePrefix: string;
	deleteBucket: boolean;
}
export class S3 extends Construct {
	public readonly bucketName: string;
	public readonly bucketArn: string;

	constructor(scope: Construct, id: string, props: S3ConstructProperties) {
		super(scope, id);

		const bucket = new s3.Bucket(this, `${props.cdkResourceNamePrefix}Bucket`, {
			bucketName: props.bucketName,
			encryption: s3.BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180),
				},
			],
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: props.deleteBucket,
			versioned: !props.deleteBucket,
			serverAccessLogsPrefix: 'access-logs/',
			removalPolicy: props.deleteBucket ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
		});

		this.bucketArn = bucket.bucketArn;
		this.bucketName = bucket.bucketName;

		new StringParameter(this, `${props.cdkResourceNamePrefix}BucketNameParameter`, {
			parameterName: bucketNameParameter(props.environment),
			description: `${props.cdkResourceNamePrefix} AGIE bucket (${props.environment})`,
			stringValue: this.bucketName,
		});

		new StringParameter(this, `${props.cdkResourceNamePrefix}BucketArnParameter`, {
			parameterName: bucketArnParameter(props.environment),
			description: `${props.cdkResourceNamePrefix} AGIE bucket (${props.environment})`,
			stringValue: this.bucketArn,
		});
	}
}

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

import { getLambdaArchitecture } from '@agie/cdk-common';
import { Duration, Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CustomResource } from 'aws-cdk-lib/core';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VerifiedPermissionsIdentitySourceCreatorConstructProperties {
	environment: string;
	policyStoreId: string;
	userPoolArn: string;
	identitySourceIdParameter: string;
}

export class VerifiedPermissionsIdentitySourceCreator extends Construct {
	public readonly verifiedPermissionsCustomResourceLambda: NodejsFunction;

	constructor(scope: Construct, id: string, props: VerifiedPermissionsIdentitySourceCreatorConstructProperties) {
		super(scope, id);

		const namePrefix = `agie-${props.environment}`;
		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		// A custom resource that creates a verified permissions identity source as cognito
		this.verifiedPermissionsCustomResourceLambda = new NodejsFunction(this, 'VerifiedPermissionsIdentitySourceCreatorLambda', {
			functionName: `${namePrefix}-verifiedPermissions-identitySource-creator`,
			description: `Verified Permissions identity source creator.`,
			entry: path.join(__dirname, './customResources/verifiedPermissions.CustomResource.ts'),
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 128,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['pg-native'],
			},
			environment: {
				USER_POOL_ARN: props.userPoolArn,
				POLICY_STORED_ID: props.policyStoreId,
				IDENTITY_STORE_ID_PARAMETER: props.identitySourceIdParameter,
				ENVIRONMENT: props.environment,
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		this.verifiedPermissionsCustomResourceLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['verifiedpermissions:CreateIdentitySource', 'verifiedpermissions:DeleteIdentitySource'],
				resources: [`arn:aws:verifiedpermissions::${accountId}:policy-store/${props.policyStoreId}`],
			})
		);

		this.verifiedPermissionsCustomResourceLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['ssm:GetParameter', 'ssm:PutParameter', 'ssm:DeleteParameter'],
				resources: [`arn:aws:ssm:${region}:${accountId}:parameter/agie/${props.environment}/*`],
			})
		);

		this.verifiedPermissionsCustomResourceLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['cognito-idp:DescribeUserPool'],
				// TODO: lock down to specific user pool
				resources: [`arn:aws:cognito-idp:${region}:${accountId}:userpool/*`],
			})
		);

		const customResourceProvider = new Provider(this, 'CustomResourceProvider', {
			onEventHandler: this.verifiedPermissionsCustomResourceLambda,
		});

		new CustomResource(this, 'VerifiedPermissionsIdentitySourceCreatorCustomResource', {
			serviceToken: customResourceProvider.serviceToken,
			properties: {
				uniqueToken: Date.now(),
			},
		});

		NagSuppressions.addResourceSuppressions(
			this.verifiedPermissionsCustomResourceLambda,
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This only contains the policy the create and insert log to log group.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<CognitoIdpCreatorCognitoIdpCreatorLambda0153435B.Arn>:*'],
					reason: 'This only applies to the seeder lambda defined in this construct and its versions.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::arn:aws:ssm:${region}:${accountId}:parameter/agie/${props.environment}/*`],
					reason: 'The resource condition allows performing GetSSMParameter calls locked down to environment specific parameters.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::arn:aws:cognito-idp:${region}:${accountId}:userpool/*`],
					// TODO: remove one locked down to specific user pool
					reason: 'Temporary.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			customResourceProvider,
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This only contains the policy the create and insert log to log group.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<VerifiedPermissionsIdentitySourceCreatorVerifiedPermissionsIdentitySourceCreatorLambda032FA7D1.Arn>:*'],
					reason: 'This only applies to the lambda defined in this construct and its versions.',
				},
				{
					id: 'AwsSolutions-L1',
					reason: 'The cr.Provider library is not maintained by this project.',
				},
			],
			true
		);
	}
}

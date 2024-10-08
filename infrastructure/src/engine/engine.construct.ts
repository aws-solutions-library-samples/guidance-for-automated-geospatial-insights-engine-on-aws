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

import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Size, Stack } from 'aws-cdk-lib';
import { EcsFargateContainerDefinition, EcsJobDefinition, FargateComputeEnvironment, JobQueue } from 'aws-cdk-lib/aws-batch';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImage, CpuArchitecture, OperatingSystemFamily } from 'aws-cdk-lib/aws-ecs';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EngineConstructProperties {
	readonly vpc: IVpc;
	readonly environment: string;
	readonly bucketName: string;
	readonly eventBusName: string;
	readonly stacApiEndpoint: string;
	readonly stacApiResourceArn: string;
	readonly sentinelApiUrl: string;
	readonly sentinelCollection: string;
}

export const engineProcessorJobDefinitionArnParameter = (environment: string) => `/agie/${environment}/scheduler/engineProcessorJobDefinitionArn`;
export const engineProcessorHighPriorityQueueArn = (environment: string) => `/agie/${environment}/scheduler/engineProcessorHighPriorityQueueArn`;
export const engineProcessorStandardPriorityQueueArn = (environment: string) => `/agie/${environment}/scheduler/engineProcessorStandardPriorityQueueArn`;
export const engineProcessorLowPriorityQueueArn = (environment: string) => `/agie/${environment}/scheduler/engineProcessorLowPriorityQueueArn`;

export class EngineConstruct extends Construct {
	constructor(scope: Construct, id: string, props: EngineConstructProperties) {
		super(scope, id);

		const namePrefix = `agie-${props.environment}`;

		const accessLogBucket = new Bucket(this, 's3AccessLog', {
			bucketName: `${namePrefix}-${Stack.of(this).account}-${Stack.of(this).region}-access-log`,
			encryption: BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180)
				}
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: true,
			versioned: false,
			removalPolicy: RemovalPolicy.DESTROY
		});

		NagSuppressions.addResourceSuppressions(accessLogBucket, [
			{
				id: 'AwsSolutions-S1',
				reason: 'This is only the access log not the log that contains the vpc traffic information.'
			}
		]);

		const bucket = Bucket.fromBucketName(scope, 'SharedBucket', props.bucketName);
		const eventBus = EventBus.fromEventBusName(scope, 'SharedEventBus', props.eventBusName);

		const engineProcessorContainerAsset = new ecr_assets.DockerImageAsset(this, 'EngineProcessorContainerAsset', {
			directory: path.join(__dirname, '../../../python/apps/satellite-image-processor')
		});

		const jobRole = new Role(this, 'ContainerJobRole', {
			assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com')
		});

		// The job role is assumed by the code running inside the container
		bucket.grantReadWrite(jobRole);
		eventBus.grantPutEventsTo(jobRole);
		jobRole.addToPolicy(
			new PolicyStatement({
				actions: ['execute-api:Invoke'],
				effect: Effect.ALLOW,
				resources: [props.stacApiResourceArn]
			})
		);

		// Create an AWS Batch Job Definition
		const engineProcessorJobDefinition = new EcsJobDefinition(this, 'EngineProcessorJobDefinition', {
			jobDefinitionName: `${namePrefix}-engine-processor`,
			container: new EcsFargateContainerDefinition(this, 'EngineProcessorContainerDefinition', {
				image: ContainerImage.fromRegistry(engineProcessorContainerAsset.imageUri),
				memory: Size.mebibytes(2048),
				cpu: 1,
				fargateCpuArchitecture: CpuArchitecture.X86_64,
				fargateOperatingSystemFamily: OperatingSystemFamily.LINUX,
				jobRole,
				environment: {
					EVENT_BUS_NAME: eventBus.eventBusName,
					OUTPUT_BUCKET: bucket.bucketName,
					STAC_API_ENDPOINT: props.stacApiEndpoint,
					SENTINEL_API_URL: props.sentinelApiUrl,
					SENTINEL_COLLECTION: props.sentinelCollection
				}
			})
		});

		new StringParameter(this, 'engineProcessorJobDefinitionParameter', {
			parameterName: engineProcessorJobDefinitionArnParameter(props.environment),
			stringValue: engineProcessorJobDefinition.jobDefinitionArn
		});

		// This role is assumed by the ecs agent which will pull the container image from ecr repository
		engineProcessorContainerAsset.repository.grantRead(engineProcessorJobDefinition.container.executionRole);

		engineProcessorJobDefinition.container.executionRole.addManagedPolicy(
			ManagedPolicy.fromManagedPolicyArn(this, 'AmazonECSTaskExecutionRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy')
		);

		const computeEnvironment = new FargateComputeEnvironment(this, 'FargateComputeEnvironment', {
			vpc: props.vpc
		});

		const highPriorityQueue = new JobQueue(this, 'HighPriorityQueue', {
			computeEnvironments: [
				{
					computeEnvironment,
					order: 1
				}
			],
			priority: 10
		});

		const standardPriorityQueue = new JobQueue(this, 'StandardPriorityQueue', {
			computeEnvironments: [
				{
					computeEnvironment,
					order: 1
				}
			],
			priority: 5
		});

		const lowPriorityQueue = new JobQueue(this, 'LowPriorityQueue', {
			computeEnvironments: [
				{
					computeEnvironment,
					order: 1
				}
			],
			priority: 1
		});

		new StringParameter(this, 'engineProcessorHighPriorityQueueArn', {
			parameterName: engineProcessorHighPriorityQueueArn(props.environment),
			stringValue: highPriorityQueue.jobQueueArn
		});

		new StringParameter(this, 'engineProcessorStandardPriorityQueueArn', {
			parameterName: engineProcessorStandardPriorityQueueArn(props.environment),
			stringValue: standardPriorityQueue.jobQueueArn
		});

		new StringParameter(this, 'engineProcessorLowPriorityQueueArn', {
			parameterName: engineProcessorLowPriorityQueueArn(props.environment),
			stringValue: lowPriorityQueue.jobQueueArn
		});

		const account = cdk.Stack.of(this).account;
		const region = cdk.Stack.of(this).region;

		NagSuppressions.addResourceSuppressions(
			engineProcessorJobDefinition.container,
			[
				{
					id: 'AwsSolutions-IAM5',
					reason: 'Ignore for now.',
					appliesTo: [`Resource::arn:<AWS::Partition>:logs:${region}:${account}:log-group:/aws/batch/job:*`]
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			engineProcessorJobDefinition.container.executionRole,
			[
				{
					id: 'AwsSolutions-IAM4',
					reason: 'This is required for the container to pull the necessary images from ECR.',
					appliesTo: [`Policy::arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`]
				},
				{
					id: 'AwsSolutions-IAM5',
					reason: 'This resource condition in the IAM policy is generated by CDK, this only applies to logs:DeleteRetentionPolicy and logs:PutRetentionPolicy actions.',
					appliesTo: ['Resource:arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/batch/job:*']
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			jobRole,
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [
						'Action::s3:Abort*',
						'Action::s3:DeleteObject*',
						'Action::s3:GetBucket*',
						'Action::s3:GetObject*',
						'Action::s3:List*',
						'Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*',
						'Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/batch/job:*',
						`Resource::arn:<AWS::Partition>:execute-api:${region}:${account}:<StacServerModuleStacApiGateway48C0D803>/*/*/*`
					],
					reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.'
				}
			],
			true
		);
	}
}

import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Size, Stack } from 'aws-cdk-lib';
import { EcsFargateContainerDefinition, EcsJobDefinition, FargateComputeEnvironment, JobQueue } from 'aws-cdk-lib/aws-batch';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImage, CpuArchitecture, OperatingSystemFamily } from 'aws-cdk-lib/aws-ecs';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EngineConstructProperties {
	vpc: IVpc;
	environment: string;
	bucketName: string;
	eventBusName: string;
	stacServerUrl: string;
}

export const engineProcessorJobDefinitionArnParameter = (environment: string) => `/arcade/${environment}/scheduler/engineProcessorJobDefinitionArn`;
export const engineProcessorJobQueueArnParameter = (environment: string) => `/arcade/${environment}/scheduler/engineProcessorJobQueueArn`;

export class EngineConstruct extends Construct {
	constructor(scope: Construct, id: string, props: EngineConstructProperties) {
		super(scope, id);

		const namePrefix = `arcade-${props.environment}`;

		const accessLogBucket = new Bucket(this, 's3AccessLog', {
			bucketName: `${namePrefix}-${Stack.of(this).account}-${Stack.of(this).region}-access-log`,
			encryption: BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180),
				},
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: true,
			versioned: false,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		NagSuppressions.addResourceSuppressions(accessLogBucket, [
			{
				id: 'AwsSolutions-S1',
				reason: 'This is only the access log not the log that contains the vpc traffic information.',
			},
		]);

		const bucket = Bucket.fromBucketName(scope, 'SharedBucket', props.bucketName);
		const eventBus = EventBus.fromEventBusName(scope, 'SharedEventBus', props.eventBusName);

		const engineProcessorContainerAsset = new ecr_assets.DockerImageAsset(this, 'EngineProcessorContainerAsset', {
			directory: path.join(__dirname, '../../../python/apps/arcade-pipeline'),
		});

		const jobRole = new Role(this, 'ContainerJobRole', {
			assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
		});

		// The job role is assumed by the code running inside the container
		bucket.grantReadWrite(jobRole);
		eventBus.grantPutEventsTo(jobRole);

		// Create an AWS Batch Job Definition
		const engineProcessorJobDefinition = new EcsJobDefinition(this, 'EngineProcessorJobDefinition', {
			jobDefinitionName: `${namePrefix}-engine-processor`,
			container: new EcsFargateContainerDefinition(this, 'EngineProcessorContainerDefinition', {
				image: ContainerImage.fromRegistry(engineProcessorContainerAsset.imageUri),
				memory: Size.mebibytes(4096),
				cpu: 2,
				ephemeralStorageSize: Size.gibibytes(100),
				fargateCpuArchitecture: CpuArchitecture.X86_64,
				fargateOperatingSystemFamily: OperatingSystemFamily.LINUX,
				jobRole,
				environment: {
					EVENT_BUS_NAME: eventBus.eventBusName,
					OUTPUT_BUCKET: bucket.bucketName,
					ARCADE_STAC_SERVER_URL: props.stacServerUrl,
				},
			}),
		});

		new StringParameter(this, 'engineProcessorJobDefinitionParameter', {
			parameterName: engineProcessorJobDefinitionArnParameter(props.environment),
			stringValue: engineProcessorJobDefinition.jobDefinitionArn,
		});

		// This role is assumed by the ecs agent which will pull the container image from ecr repository
		engineProcessorContainerAsset.repository.grantRead(engineProcessorJobDefinition.container.executionRole);

		engineProcessorJobDefinition.container.executionRole.addManagedPolicy(
			ManagedPolicy.fromManagedPolicyArn(this, 'AmazonECSTaskExecutionRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy')
		);

		const queue = new JobQueue(this, 'JobQueue', {
			computeEnvironments: [
				{
					computeEnvironment: new FargateComputeEnvironment(this, 'FargateComputeEnvironment', {
						vpc: props.vpc,
					}),
					order: 1,
				},
			],
			priority: 10,
		});

		new StringParameter(this, 'EngineProcessorJobQueueArnParameter', {
			parameterName: engineProcessorJobQueueArnParameter(props.environment),
			stringValue: queue.jobQueueArn,
		});

		const account = cdk.Stack.of(this).account;
		const region = cdk.Stack.of(this).region;

		NagSuppressions.addResourceSuppressions(
			engineProcessorJobDefinition.container,
			[
				{
					id: 'AwsSolutions-IAM5',
					reason: 'Ignore for now.',
					appliesTo: [`Resource::arn:<AWS::Partition>:logs:${region}:${account}:log-group:/aws/batch/job:*`],
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			engineProcessorJobDefinition.container.executionRole,
			[
				{
					id: 'AwsSolutions-IAM4',
					reason: 'This is required for the container to pull the necessary images from ECR.',
					appliesTo: [`Policy::arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`],
				},
				{
					id: 'AwsSolutions-IAM5',
					reason: 'This resource condition in the IAM policy is generated by CDK, this only applies to logs:DeleteRetentionPolicy and logs:PutRetentionPolicy actions.',
					appliesTo: ['Resource:arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/batch/job:*'],
				},
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
					],
					reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.',
				},
			],
			true
		);
	}
}

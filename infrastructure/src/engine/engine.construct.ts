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

import { DynamoDBSeeder, getLambdaArchitecture, Seeds } from '@agie/cdk-common';
import { REGIONS_EVENT_SOURCE, REGIONS_REGION_CREATED_EVENT, REGIONS_REGION_DELETED_EVENT, REGIONS_REGION_UPDATED_EVENT } from '@agie/events';
import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Size, Stack } from 'aws-cdk-lib';
import {
	AccessLogFormat,
	AuthorizationType,
	CfnMethod,
	Cors,
	EndpointType,
	IdentitySource,
	LambdaRestApi,
	LogGroupLogDestination,
	MethodLoggingLevel,
	RequestAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { EcsFargateContainerDefinition, EcsJobDefinition, FargateComputeEnvironment, JobQueue } from 'aws-cdk-lib/aws-batch';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImage, CpuArchitecture, OperatingSystemFamily } from 'aws-cdk-lib/aws-ecs';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { AnyPrincipal, Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
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
	readonly cognitoUserPoolId: string;
	readonly cognitoClientId: string;
	readonly policyStoreId: string;
}

export const engineProcessorJobDefinitionArnParameter = (environment: string) => `/agie/${environment}/scheduler/engineProcessorJobDefinitionArn`;
export const engineProcessorDefaultResourceEngineIdParameter = (environment: string) => `/agie/${environment}/engine/engineProcessorDefaultEngineId`;
export const engineProcessorHighPriorityQueueArn = (environment: string) => `/agie/${environment}/scheduler/engineProcessorHighPriorityQueueArn`;
export const engineProcessorStandardPriorityQueueArn = (environment: string) => `/agie/${environment}/scheduler/engineProcessorStandardPriorityQueueArn`;
export const engineProcessorLowPriorityQueueArn = (environment: string) => `/agie/${environment}/scheduler/engineProcessorLowPriorityQueueArn`;
export const engineApiUrlParameter = (environment: string) => `/agie/${environment}/engine/apiUrl`;
export const engineApiNameParameter = (environment: string) => `/agie/${environment}/engine/apiName`;
export const engineTableNameParameter = (environment: string) => `/agie/${environment}/engine/tableName`;
export const engineContainerExecutionRoleArnNameParameter = (environment: string) => `/agie/${environment}/engine/containerExecutionRoleArn`;
export const engineApiFunctionArnParameter = (environment: string) => `/agie/${environment}/engine/apiFunctionArn`;

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
			directory: path.join(__dirname, '../../../python/apps/satellite-image-processor'),
		});

		const jobRole = new Role(this, 'ContainerJobRole', {
			assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
		});

		// The job role is assumed by the code running inside the container
		bucket.grantReadWrite(jobRole);
		eventBus.grantPutEventsTo(jobRole);
		jobRole.addToPolicy(
			new PolicyStatement({
				actions: ['execute-api:Invoke'],
				effect: Effect.ALLOW,
				resources: [props.stacApiResourceArn],
			})
		);

		const executionRole = new Role(this, 'ContainerExecutionRole', {
			roleName: `${namePrefix}-engine-execution-role`,
			assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				ManagedPolicy.fromManagedPolicyArn(this, 'AmazonECSTaskExecutionRolePolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'),
			],
		});

		const account = cdk.Stack.of(this).account;
		const region = cdk.Stack.of(this).region;

		executionRole.addToPolicy(
			new PolicyStatement({
				actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
				effect: Effect.ALLOW,
				resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/batch/job:*`],
			})
		);

		executionRole.addToPolicy(
			new PolicyStatement({
				actions: ['ecr:DescribeImages', 'ecr:DescribeRepositories'],
				effect: Effect.ALLOW,
				resources: [`arn:aws:ecr:${region}:${account}:repository/*`],
			})
		);

		const jobDefinitionName = `${namePrefix}-engine-processor`;
		const jobDefinitionMemory = 2048;
		const jobDefinitionCpu = 1;

		// Create an AWS Batch Job Definition
		const engineProcessorJobDefinition = new EcsJobDefinition(this, 'EngineProcessorJobDefinition', {
			jobDefinitionName: jobDefinitionName,
			container: new EcsFargateContainerDefinition(this, 'EngineProcessorContainerDefinition', {
				image: ContainerImage.fromRegistry(engineProcessorContainerAsset.imageUri),
				executionRole: executionRole,
				memory: Size.mebibytes(jobDefinitionMemory),
				cpu: jobDefinitionCpu,
				fargateCpuArchitecture: CpuArchitecture.X86_64,
				fargateOperatingSystemFamily: OperatingSystemFamily.LINUX,
				jobRole,
				environment: {
					EVENT_BUS_NAME: eventBus.eventBusName,
					OUTPUT_BUCKET: bucket.bucketName,
					STAC_API_ENDPOINT: props.stacApiEndpoint,
					SENTINEL_API_URL: props.sentinelApiUrl,
					SENTINEL_COLLECTION: props.sentinelCollection,
				},
			}),
			propagateTags: true,
		});

		new StringParameter(this, 'engineProcessorJobDefinitionParameter', {
			parameterName: engineProcessorJobDefinitionArnParameter(props.environment),
			stringValue: engineProcessorJobDefinition.jobDefinitionArn,
		});

		new StringParameter(this, 'engineContainerExecutionRoleArnNameParameter', {
			parameterName: engineContainerExecutionRoleArnNameParameter(props.environment),
			stringValue: executionRole.roleArn,
		});

		const computeEnvironment = new FargateComputeEnvironment(this, 'FargateComputeEnvironment', {
			vpc: props.vpc,
		});

		const highPriorityQueue = new JobQueue(this, 'HighPriorityQueue', {
			computeEnvironments: [
				{
					computeEnvironment,
					order: 1,
				},
			],
			priority: 10,
		});

		const standardPriorityQueue = new JobQueue(this, 'StandardPriorityQueue', {
			computeEnvironments: [
				{
					computeEnvironment,
					order: 1,
				},
			],
			priority: 5,
		});

		const lowPriorityQueue = new JobQueue(this, 'LowPriorityQueue', {
			computeEnvironments: [
				{
					computeEnvironment,
					order: 1,
				},
			],
			priority: 1,
		});

		new StringParameter(this, 'engineProcessorHighPriorityQueueArn', {
			parameterName: engineProcessorHighPriorityQueueArn(props.environment),
			stringValue: highPriorityQueue.jobQueueArn,
		});

		new StringParameter(this, 'engineProcessorStandardPriorityQueueArn', {
			parameterName: engineProcessorStandardPriorityQueueArn(props.environment),
			stringValue: standardPriorityQueue.jobQueueArn,
		});

		new StringParameter(this, 'engineProcessorLowPriorityQueueArn', {
			parameterName: engineProcessorLowPriorityQueueArn(props.environment),
			stringValue: lowPriorityQueue.jobQueueArn,
		});

		// DynamoDb Table
		const table = new Table(this, 'Table', {
			tableName: `${namePrefix}-engine`,
			partitionKey: {
				name: 'pk',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'sk',
				type: AttributeType.STRING,
			},
			billingMode: BillingMode.PAY_PER_REQUEST,
			encryption: TableEncryption.AWS_MANAGED,
			pointInTimeRecovery: true,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		table.addGlobalSecondaryIndex({
			indexName: 'siKey1-sk-index',
			partitionKey: {
				name: 'siKey1',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'sk',
				type: AttributeType.STRING,
			},
			projectionType: ProjectionType.ALL,
		});

		new StringParameter(this, `EngineTableNameParameter`, {
			parameterName: engineTableNameParameter(props.environment),
			stringValue: table.tableName,
		});

		const defaultEngineId = '01jbv2nam8p67r7d4vzw8jhn02';

		new DynamoDBSeeder(this, 'EngineResourceSeeder', {
			table: table,
			seeds: Seeds.fromInline([
				{
					pk: `en:${defaultEngineId}`,
					sk: `en:${defaultEngineId}`,
					environment: {
						EVENT_BUS_NAME: eventBus.eventBusName,
						OUTPUT_BUCKET: bucket.bucketName,
						STAC_API_ENDPOINT: props.stacApiEndpoint,
						SENTINEL_API_URL: props.sentinelApiUrl,
						SENTINEL_COLLECTION: props.sentinelCollection,
					},
					id: defaultEngineId,
					image: engineProcessorContainerAsset.imageUri,
					jobDefinitionArn: engineProcessorJobDefinition.jobDefinitionArn,
					jobRoleArn: engineProcessorJobDefinition.container.jobRole.roleArn,
					memory: jobDefinitionMemory,
					name: jobDefinitionName,
					siKey1: 'et:',
					vcpus: jobDefinitionCpu,
					createdBy: '@agie/cli',
					createdAt: new Date(Date.now()).toISOString(),
				},
			]),
		});

		new StringParameter(this, `EngineProcessorDefaultEngineIdParameter`, {
			parameterName: engineProcessorDefaultResourceEngineIdParameter(props.environment),
			stringValue: defaultEngineId,
		});

		/**
		 * Define the API Lambda
		 */
		const apiLambda = new NodejsFunction(this, 'EngineApiLambda', {
			functionName: `${namePrefix}-engineApi`,
			description: `AGIE: Engine API: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/engine/src/lambda_apiGateway.ts'),
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			timeout: Duration.seconds(29),
			logRetention: RetentionDays.ONE_WEEK,
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				ENVIRONMENT: props.environment,
				NODE_ENV: 'cloud',
				TABLE_NAME: table.tableName,
				CONTAINER_EXECUTION_ROLE_ARN: executionRole.roleArn,
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk'],
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		table.grantReadWriteData(apiLambda);

		apiLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['batch:RegisterJobDefinition', 'batch:DeregisterJobDefinition'],
				resources: [`arn:aws:batch:${region}:${account}:job-definition/*`],
			})
		);

		apiLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['iam:PassRole', 'iam:GetRole'],
				resources: [`arn:aws:iam::${account}:role/*`],
			})
		);

		new StringParameter(this, 'EngineApiFunctionArnParameter', {
			parameterName: engineApiFunctionArnParameter(props.environment),
			stringValue: apiLambda.functionArn,
		});

		/**
		 * Define the APIGW Authorizer
		 */
		const authorizerLambda = new NodejsFunction(this, 'EngineApiAuthorizerLambda', {
			functionName: `${namePrefix}-EngineApi-authorizer`,
			description: `AGIE: Engine API Authorizer: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/engine/src/lambda_authorizer.ts'),
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.seconds(5),
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
				NODE_ENV: 'cloud',
				POLICY_STORE_ID: props.policyStoreId,
				USER_POOL_ID: props.cognitoUserPoolId,
				CLIENT_ID: props.cognitoClientId,
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		/**
		 * Define the API Gateway
		 */
		const authorizer = new RequestAuthorizer(this, 'Authorizer', {
			handler: authorizerLambda,
			identitySources: [IdentitySource.header('Authorization'), IdentitySource.context('path'), IdentitySource.context('httpMethod')],
		});

		const logGroup = new LogGroup(this, 'EngineApiLogs');
		const apigw = new LambdaRestApi(this, 'EngineApiGateway', {
			restApiName: `${namePrefix}-engine`,
			description: `AGIE: Engine API: ${props.environment}`,
			handler: apiLambda,
			proxy: true,
			deployOptions: {
				stageName: 'prod',
				accessLogDestination: new LogGroupLogDestination(logGroup),
				accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
				loggingLevel: MethodLoggingLevel.INFO,
			},
			defaultCorsPreflightOptions: {
				allowOrigins: Cors.ALL_ORIGINS,
				allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent', 'Accept-Version'],
			},
			endpointTypes: [EndpointType.REGIONAL],
			defaultMethodOptions: {
				authorizationType: AuthorizationType.CUSTOM,
				authorizer,
			},
		});

		cdk.Aspects.of(apigw).add({
			visit(node) {
				if (node instanceof CfnMethod && node.httpMethod === 'OPTIONS') {
					node.addPropertyOverride('AuthorizationType', 'NONE');
				}
			},
		});

		apigw.node.addDependency(apiLambda);

		new StringParameter(this, 'EngineApiUrlParameter', {
			parameterName: engineApiUrlParameter(props.environment),
			stringValue: apigw.url,
		});

		new StringParameter(this, 'EngineApiNameParameter', {
			parameterName: engineApiNameParameter(props.environment),
			stringValue: apigw.restApiName,
		});

		authorizerLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['verifiedpermissions:IsAuthorizedWithToken'],
				resources: [`arn:aws:verifiedpermissions::${account}:policy-store/${props.policyStoreId}`],
			})
		);

		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			description: 'Engine module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/engine/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-engine-eventbridge-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				ENVIRONMENT: props.environment,
				TABLE_NAME: table.tableName,
				AWS_ACCOUNT_ID: account,
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.1',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk', 'pg-native'],
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		table.grantReadWriteData(eventbridgeLambda);

		const regionModifiedRule = new Rule(this, 'RegionModifiedRule', {
			eventBus: eventBus,
			eventPattern: {
				detailType: [
					// These events will trigger the creation/deletion of schedule for a region
					REGIONS_REGION_CREATED_EVENT,
					REGIONS_REGION_UPDATED_EVENT,
					REGIONS_REGION_DELETED_EVENT,
				],
				source: [REGIONS_EVENT_SOURCE],
			},
		});

		const executorEventBridgeHandlerDLQ = new Queue(this, 'ExecutorEventBridgeHandlerDLQ');

		executorEventBridgeHandlerDLQ.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [executorEventBridgeHandlerDLQ.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		regionModifiedRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: executorEventBridgeHandlerDLQ,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2,
			})
		);

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
						`Resource::arn:<AWS::Partition>:execute-api:${region}:${account}:<StacServerModuleStacApiGateway48C0D803>/*/*/*`,
					],
					reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[apiLambda],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::arn:aws:batch:${region}:${account}:job-definition/*`, `Resource::arn:aws:iam::${account}:role/*`],
					reason: 'The api lambda need permission to register AWS Batch job definition and pass role to the Batch Job.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[apiLambda, eventbridgeLambda],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [
						'Action::s3:Abort*',
						'Action::s3:DeleteObject*',
						'Action::s3:GetBucket*',
						'Action::s3:GetObject*',
						'Action::s3:List*',
						'Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*',
						'Resource::<EngineModuleTable41DDCD39.Arn>/index/*',
					],
					reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[executorEventBridgeHandlerDLQ],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[authorizerLambda],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[executionRole],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::arn:aws:logs:${region}:${account}:log-group:/aws/batch/job:*`, `Resource::arn:aws:ecr:${region}:${account}:repository/*`],
					reason: 'The container execution role needs to be able push log for aws batch and also pull images from ECR.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[apigw],
			[
				{
					id: 'AwsSolutions-APIG2',
					reason: 'Request validation is being done by the Fastify module.',
				},
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'],
					reason: 'API GW needs this policy to push logs to cloudwatch.',
				},
				{
					id: 'AwsSolutions-APIG4',
					reason: 'OPTIONS has no auth.',
				},
				{
					id: 'AwsSolutions-COG4',
					reason: 'OPTIONS does not use Cognito auth.',
				},
			],
			true
		);
	}
}

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
import {
	REGIONS_POLYGON_CREATED_EVENT,
	REGIONS_POLYGON_DELETED_EVENT,
	REGIONS_POLYGON_UPDATED_EVENT,
	REGIONS_REGION_CREATED_EVENT,
	REGIONS_REGION_DELETED_EVENT,
	REGIONS_REGION_UPDATED_EVENT,
} from '@agie/events';
import { Aspects, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
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
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { IVpc, Port, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { CfnServerlessCache } from 'aws-cdk-lib/aws-elasticache';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RegionsConstructProperties {
	environment: string;
	cognitoUserPoolId: string;
	cognitoClientId: string;
	eventBusName: string;
	policyStoreId: string;
	vpc: IVpc;
	useRegionCache: boolean;
	engineApiLambda: IFunction;
}

export const regionsTaskQueueUrlParameter = (environment: string) => `/agie/${environment}/regions/taskQueueUrl`;
export const regionsApiFunctionArnParameter = (environment: string) => `/agie/${environment}/regions/apiFunctionArn`;
const regionsApiAuthorizerFunctionArnParameter = (environment: string) => `/agie/${environment}/regions/verifiedPermissionsAuthorizerFunctionArn`;
export const regionsApiUrlParameter = (environment: string) => `/agie/${environment}/regions/apiUrl`;
export const regionsApiNameParameter = (environment: string) => `/agie/${environment}/regions/apiName`;
const regionsTableNameParameter = (environment: string) => `/agie/${environment}/regions/tableName`;
const regionsTableArnParameter = (environment: string) => `/agie/${environment}/regions/tableArn`;

export class RegionsModule extends Construct {
	public readonly regionsFunctionName: string;
	public readonly regionsFunctionArn: string;
	public readonly tableName: string;

	constructor(scope: Construct, id: string, props: RegionsConstructProperties) {
		super(scope, id);

		const account = Stack.of(this).account;
		const namePrefix = `agie-${props.environment}`;

		const eventBus = EventBus.fromEventBusName(this, 'EventBus', props.eventBusName);

		/**
		 * Define the DynamoDB table
		 */
		const table = new Table(this, 'RegionsTable', {
			tableName: `${namePrefix}-regions`,
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

		// define GSI1
		table.addGlobalSecondaryIndex({
			indexName: 'siKey1-pk-index',
			partitionKey: {
				name: 'siKey1',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'pk',
				type: AttributeType.STRING,
			},
			projectionType: ProjectionType.ALL,
		});

		// define GSI2
		table.addGlobalSecondaryIndex({
			indexName: 'type-sk-index',
			partitionKey: {
				name: 'type',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'sk',
				type: AttributeType.STRING,
			},
			projectionType: ProjectionType.ALL,
		});

		// define GSI3
		table.addGlobalSecondaryIndex({
			indexName: 'siKey2-siKey3-index',
			partitionKey: {
				name: 'siKey2',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'siKey3',
				type: AttributeType.STRING,
			},
			projectionType: ProjectionType.ALL,
		});

		this.tableName = table.tableName;

		new StringParameter(this, `RegionsTableNameParameter`, {
			parameterName: regionsTableNameParameter(props.environment),
			stringValue: table.tableName,
		});

		new StringParameter(this, `RegionsTableArnParameter`, {
			parameterName: regionsTableArnParameter(props.environment),
			stringValue: table.tableArn,
		});

		/**
		 * Define the Redis Serverless cache
		 */

		let vpcConfiguration = {},
			redisEndpoint;

		if (props.useRegionCache) {
			const redisSecurityGroup = new SecurityGroup(this, 'redisSecurityGroup', {
				vpc: props.vpc,
			});

			const regionServerlessCache = new CfnServerlessCache(this, 'RegionServerlessCache', {
				engine: 'redis',
				serverlessCacheName: `${namePrefix}-serverless-cache`,
				dailySnapshotTime: '14:00',
				description: 'description',
				majorEngineVersion: '7',
				securityGroupIds: [redisSecurityGroup.securityGroupId],
				subnetIds: props.vpc.isolatedSubnets.map((o) => o.subnetId),
			});

			redisSecurityGroup.addIngressRule(redisSecurityGroup, Port.tcp(6380), 'allow connection to redis writer endpoint');
			redisSecurityGroup.addIngressRule(redisSecurityGroup, Port.tcp(6379), 'allow connection to redis reader endpoint');

			redisEndpoint = regionServerlessCache.attrReaderEndpointAddress;

			vpcConfiguration = {
				securityGroups: [redisSecurityGroup],
				vpc: props.vpc,
				vpcSubnets: props.vpc.selectSubnets({
					subnetType: SubnetType.PRIVATE_WITH_EGRESS,
				}),
			};
		}

		/**
		 * Define the SQS queues
		 */
		const taskDlq = new Queue(this, `TaskDlq`, { queueName: `${namePrefix}-task-dlq` });

		taskDlq.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [taskDlq.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		const taskQueue = new Queue(this, `TaskQueue`, {
			queueName: `${namePrefix}-task`,
			deadLetterQueue: {
				maxReceiveCount: 10,
				queue: taskDlq,
			},
			visibilityTimeout: Duration.seconds(90),
		});

		new StringParameter(this, `RegionTaskQueueUrlParameter`, {
			parameterName: regionsTaskQueueUrlParameter(props.environment),
			stringValue: taskQueue.queueUrl,
		});

		taskQueue.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [taskQueue.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		const commonLambdaConfiguration: Pick<NodejsFunctionProps, 'bundling' | 'tracing' | 'runtime' | 'depsLockFilePath' | 'architecture' | 'logRetention'> = {
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			logRetention: RetentionDays.ONE_WEEK,
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
		};

		/**
		 * Define the SQS Lambdas
		 */
		const sqsLambdaTask = new NodejsFunction(this, 'SqsLambdaTask', {
			...commonLambdaConfiguration,
			...vpcConfiguration,
			functionName: `${namePrefix}-regions-task-sqs`,
			description: `Regions Task SQS: Environment ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/regions/src/lambda_tasks_sqs.ts'),
			memorySize: 512,
			timeout: Duration.seconds(30),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				NODE_ENV: 'cloud',
				TABLE_NAME: table.tableName,
				TASK_QUEUE_URL: taskQueue.queueUrl,
				REDIS_ENDPOINT: redisEndpoint,
			},
		});
		sqsLambdaTask.node.addDependency(table);
		sqsLambdaTask.node.addDependency(taskQueue);
		sqsLambdaTask.addEventSource(
			new SqsEventSource(taskQueue, {
				batchSize: 10,
				reportBatchItemFailures: true,
			})
		);

		table.grantWriteData(sqsLambdaTask);
		table.grantReadData(sqsLambdaTask);
		// deny apiLambda accidental full table scans on table seeing as PartiQL is used
		sqsLambdaTask.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:Scan'],
				effect: Effect.DENY,
				resources: [table.tableArn],
			})
		);

		// Grant partiSQLSelect access
		sqsLambdaTask.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:PartiQLSelect'],
				effect: Effect.ALLOW,
				resources: [table.tableArn, `${table.tableArn}/index/*`],
			})
		);

		eventBus.grantPutEventsTo(sqsLambdaTask);

		/**
		 * Define the API Lambda
		 */
		const apiLambda = new NodejsFunction(this, 'RegionsApiLambda', {
			...commonLambdaConfiguration,
			...vpcConfiguration,
			functionName: `${namePrefix}-regionsApi`,
			description: `AGIE: Regions API: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/regions/src/lambda_apiGateway.ts'),
			memorySize: 256,
			timeout: Duration.seconds(29),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				ENVIRONMENT: props.environment,
				NODE_ENV: 'cloud',
				TABLE_NAME: this.tableName,
				TASK_QUEUE_URL: taskQueue.queueUrl,
				REDIS_ENDPOINT: redisEndpoint,
				ENGINES_FUNCTION_NAME: props.engineApiLambda.functionName,
			},
		});

		props.engineApiLambda.grantInvoke(apiLambda);

		apiLambda.node.addDependency(table);

		this.regionsFunctionName = apiLambda.functionName;
		this.regionsFunctionArn = apiLambda.functionArn;

		new StringParameter(this, 'regionsApiFunctionArnParameter', {
			parameterName: regionsApiFunctionArnParameter(props.environment),
			stringValue: apiLambda.functionArn,
		});

		// lambda permissions
		taskQueue.grantSendMessages(apiLambda);
		table.grantWriteData(apiLambda);
		table.grantReadData(apiLambda);
		// deny apiLambda accidental full table scans on table seeing as PartiQL is used
		apiLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:Scan'],
				effect: Effect.DENY,
				resources: [table.tableArn],
			})
		);

		// Grant partiSQLSelect access
		apiLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:PartiQLSelect'],
				effect: Effect.ALLOW,
				resources: [table.tableArn, `${table.tableArn}/index/*`],
			})
		);

		eventBus.grantPutEventsTo(apiLambda);

		/**
		 * Define the APIGW Authorizer
		 */
		const authorizerLambda = new NodejsFunction(this, 'RegionsApiAuthorizerLambda', {
			...commonLambdaConfiguration,
			functionName: `${namePrefix}-regionsApi-authorizer`,
			description: `AGIE: Regions API Authorizer: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/regions/src/lambda_authorizer.ts'),
			memorySize: 256,
			timeout: Duration.seconds(5),
			environment: {
				NODE_ENV: 'cloud',
				POLICY_STORE_ID: props.policyStoreId,
				USER_POOL_ID: props.cognitoUserPoolId,
				CLIENT_ID: props.cognitoClientId,
			},
		});

		authorizerLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['verifiedpermissions:IsAuthorizedWithToken'],
				resources: [`arn:aws:verifiedpermissions::${account}:policy-store/${props.policyStoreId}`],
			})
		);

		new StringParameter(this, 'regionsApiAuthorizerFunctionArnParameter', {
			parameterName: regionsApiAuthorizerFunctionArnParameter(props.environment),
			stringValue: authorizerLambda.functionArn,
		});

		/**
		 * Define the API Gateway
		 */
		const authorizer = new RequestAuthorizer(this, 'Authorizer', {
			handler: authorizerLambda,
			identitySources: [IdentitySource.header('Authorization'), IdentitySource.context('path'), IdentitySource.context('httpMethod')],
		});

		const logGroup = new LogGroup(this, 'RegionsApiLogs');
		const apigw = new LambdaRestApi(this, 'RegionsApiGateway', {
			restApiName: `${namePrefix}-regions`,
			description: `AGIE: Regions API: ${props.environment}`,
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

		Aspects.of(apigw).add({
			visit(node) {
				if (node instanceof CfnMethod && node.httpMethod === 'OPTIONS') {
					node.addPropertyOverride('AuthorizationType', 'NONE');
				}
			},
		});

		apigw.node.addDependency(apiLambda);

		new StringParameter(this, 'RegionsApiUrlParameter', {
			parameterName: regionsApiUrlParameter(props.environment),
			stringValue: apigw.url,
		});

		new StringParameter(this, 'RegionsApiNameParameter', {
			parameterName: regionsApiNameParameter(props.environment),
			stringValue: apigw.restApiName,
		});

		/**
		 * Defines the lambda that will update aggregated data into resources attribute
		 */
		const resourcesModifiedRule = new Rule(this, 'ResourcesModifiedRule', {
			eventBus: eventBus,
			eventPattern: {
				detailType: [
					// These events will trigger the creation/deletion of region stac item
					REGIONS_REGION_CREATED_EVENT,
					REGIONS_REGION_UPDATED_EVENT,
					REGIONS_REGION_DELETED_EVENT,
					// This events will trigger the creation of the catalog
					REGIONS_POLYGON_CREATED_EVENT,
					REGIONS_POLYGON_UPDATED_EVENT,
					REGIONS_POLYGON_DELETED_EVENT,
				],
			},
		});

		const resourcesModifiedDlq = new Queue(this, `ResourcesModifiedDLQ`, { queueName: `${namePrefix}-resources-modified-dlq.fifo`, fifo: true });

		resourcesModifiedDlq.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [resourcesModifiedDlq.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		const resourcesModifiedFifoQueue = new Queue(this, 'ResourcesModifiedFifoQueue', {
			queueName: `${namePrefix}-resources-modified-queue.fifo`,
			contentBasedDeduplication: true,
			fifo: true,
			deadLetterQueue: {
				maxReceiveCount: 10,
				queue: resourcesModifiedDlq,
			},
			visibilityTimeout: Duration.minutes(2),
		});

		resourcesModifiedFifoQueue.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [resourcesModifiedFifoQueue.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		// Lambda function that processor schedule queued in SQS
		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			...commonLambdaConfiguration,
			description: 'Regions module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/regions/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-regions-eventbridge-processor`,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				SQS_QUEUE_URL: resourcesModifiedFifoQueue.queueUrl,
			},
		});

		resourcesModifiedFifoQueue.grantSendMessages(eventbridgeLambda);

		const resourcesModifiedEventBridgeDLQ = new Queue(this, `ResourcesModifiedEventBridgeDLQ`, { queueName: `${namePrefix}-resources-modified-eventbridge-dlq` });

		resourcesModifiedEventBridgeDLQ.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [resourcesModifiedEventBridgeDLQ.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		resourcesModifiedRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: resourcesModifiedEventBridgeDLQ,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2,
			})
		);

		const sqsProcessorLambda = new NodejsFunction(this, 'SqsProcessorLambda', {
			...commonLambdaConfiguration,
			...vpcConfiguration,
			description: 'Regions module sqs processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/regions/src/lambda_sqs.ts'),
			functionName: `${namePrefix}-regions-sqs-processor`,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				ENVIRONMENT: props.environment,
				NODE_ENV: 'cloud',
				TABLE_NAME: this.tableName,
				REDIS_ENDPOINT: redisEndpoint,
			},
		});

		table.grantReadWriteData(sqsProcessorLambda);
		eventBus.grantPutEventsTo(sqsProcessorLambda);

		// deny apiLambda accidental full table scans on table seeing as PartiQL is used
		sqsProcessorLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:Scan'],
				effect: Effect.DENY,
				resources: [table.tableArn],
			})
		);

		// Grant partiSQLSelect access
		sqsProcessorLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:PartiQLSelect'],
				effect: Effect.ALLOW,
				resources: [table.tableArn, `${table.tableArn}/index/*`],
			})
		);

		sqsProcessorLambda.addEventSource(
			new SqsEventSource(resourcesModifiedFifoQueue, {
				batchSize: 10,
				reportBatchItemFailures: true,
			})
		);

		NagSuppressions.addResourceSuppressions(
			[apiLambda, sqsProcessorLambda, eventbridgeLambda, sqsLambdaTask],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: [
						'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
						'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
					],
					reason: 'This policy is the one generated by CDK.',
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
					],
					reason: 'This policy is required for the lambda to access the s3 bucket that contains reference datasets file.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::<RegionsModuleRegionsTable468824DB.Arn>/index/*`],
					reason: 'This policy is required for the lambda to access the resource api table.',
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
			[apiLambda],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<engineApiFunctionArnParameter>:*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
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

		NagSuppressions.addResourceSuppressions(
			[resourcesModifiedDlq, resourcesModifiedEventBridgeDLQ],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[resourcesModifiedFifoQueue],
			[
				{
					id: 'AwsSolutions-SQS4',
					reason: 'This is the dead letter queue.',
				},
				{
					id: 'AwsSolutions-SQS2',
					reason: 'This is the dead letter queue.',
				},
			],
			true
		);
	}
}

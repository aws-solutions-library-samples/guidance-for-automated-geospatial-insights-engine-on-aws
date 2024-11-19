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
import { EcsJobDefinition, JobQueue } from 'aws-cdk-lib/aws-batch';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface ExecutorConstructProperties {
	readonly environment: string;
	readonly eventBusName: string;
	readonly bucketName: string;
	readonly jobDefinitionArn: string;
	readonly regionsApiLambda: IFunction;
	readonly highPriorityQueueArn: string;
	readonly standardPriorityQueueArn: string;
	readonly lowPriorityQueueArn: string;
	readonly concurrencyLimit: number;
	readonly engineQueue: IQueue;
	readonly cognitoUserPoolId: string;
	readonly cognitoClientId: string;
	readonly policyStoreId: string;
	readonly engineApiLambda: IFunction;
	readonly defaultEngineResourceId: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const executorApiUrlParameter = (environment: string) => `/agie/${environment}/executor/apiUrl`;
export const executorApiNameParameter = (environment: string) => `/agie/${environment}/executor/apiName`;
export const executorTableNameParameter = (environment: string) => `/agie/${environment}/executor/tableName`;

export class ExecutorModule extends Construct {
	constructor(scope: Construct, id: string, props: ExecutorConstructProperties) {
		super(scope, id);

		const namePrefix = `agie-${props.environment}`;
		const account = Stack.of(this).account;
		const region = Stack.of(this).region;

		const engineProcessorJobDefinition = EcsJobDefinition.fromJobDefinitionArn(scope, 'EngineProcessJobDefinition', props.jobDefinitionArn);

		const highPriorityQueue = JobQueue.fromJobQueueArn(scope, 'HighPriorityQueue', props.highPriorityQueueArn);
		const standardPriorityQueue = JobQueue.fromJobQueueArn(scope, 'StandardPriorityQueue', props.standardPriorityQueueArn);
		const lowPriorityQueue = JobQueue.fromJobQueueArn(scope, 'LowPriorityQueue', props.lowPriorityQueueArn);

		const bucket = Bucket.fromBucketName(scope, 'Bucket', props.bucketName);

		const eventBus = EventBus.fromEventBusName(scope, 'Bus', props.eventBusName);

		// DynamoDb Table
		const table = new Table(this, 'Table', {
			tableName: `${namePrefix}-executor`,
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

		new StringParameter(this, `ExecutorTableNameParameter`, {
			parameterName: executorTableNameParameter(props.environment),
			stringValue: table.tableName,
		});

		// Lambda function that processor schedule queued in SQS
		const sqsProcessorLambda = new NodejsFunction(this, 'SqsProcessorLambda', {
			description: 'Executor module sqs processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/executor/src/lambda_sqs.ts'),
			functionName: `${namePrefix}-executor-sqs-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(2),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				JOB_DEFINITION_ARN: engineProcessorJobDefinition.jobDefinitionArn,
				HIGH_PRIORITY_QUEUE_ARN: highPriorityQueue.jobQueueArn,
				LOW_PRIORITY_QUEUE_ARN: lowPriorityQueue.jobQueueArn,
				STANDARD_PRIORITY_QUEUE_ARN: standardPriorityQueue.jobQueueArn,
				CONCURRENCY_LIMIT: props.concurrencyLimit.toString(),
				REGIONS_API_FUNCTION_NAME: props.regionsApiLambda.functionName,
				ENGINES_FUNCTION_NAME: props.engineApiLambda.functionName,
				BUCKET_NAME: props.bucketName,
				TABLE_NAME: table.tableName,
				DEFAULT_RESOURCE_ENGINE_ID: props.defaultEngineResourceId,
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

		props.engineApiLambda.grantInvoke(sqsProcessorLambda);

		table.grantReadWriteData(sqsProcessorLambda);
		props.regionsApiLambda.grantInvoke(sqsProcessorLambda);
		bucket.grantReadWrite(sqsProcessorLambda);
		eventBus.grantPutEventsTo(sqsProcessorLambda);

		sqsProcessorLambda.addEventSource(
			new SqsEventSource(props.engineQueue, {
				batchSize: 10,
				reportBatchItemFailures: true,
			})
		);

		sqsProcessorLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['batch:SubmitJob', 'batch:DescribeJobs', 'batch:TerminateJob', 'batch:TagResource'],
				resources: [`arn:aws:batch:${region}:${account}:job-definition/*`, highPriorityQueue.jobQueueArn, lowPriorityQueue.jobQueueArn, standardPriorityQueue.jobQueueArn],
			})
		);

		const awsBatchStateChangeRule = new Rule(this, 'AwsBatchStateChangeRule', {
			eventPattern: {
				detailType: ['Batch Job State Change'],
				source: ['aws.batch'],
				detail: {
					jobQueue: [props.lowPriorityQueueArn, props.highPriorityQueueArn, props.standardPriorityQueueArn],
				},
			},
		});

		// Lambda function that processor schedule queued in SQS
		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			description: 'Executor module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/executor/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-executor-eventbridge-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				REGIONS_API_FUNCTION_NAME: props.regionsApiLambda.functionName,
				TABLE_NAME: table.tableName,
				CONCURRENCY_LIMIT: props.concurrencyLimit.toString(),
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

		props.regionsApiLambda.grantInvoke(eventbridgeLambda);
		table.grantReadWriteData(eventbridgeLambda);
		eventBus.grantPutEventsTo(eventbridgeLambda);
		eventbridgeLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['batch:ListTagsForResource'],
				resources: ['*'],
			})
		);

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

		awsBatchStateChangeRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: executorEventBridgeHandlerDLQ,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2,
			})
		);

		/**
		 * Define the API Lambda
		 */
		const apiLambda = new NodejsFunction(this, 'ExecutorApiLambda', {
			functionName: `${namePrefix}-executorApi`,
			description: `AGIE: Executor API: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/executor/src/lambda_apiGateway.ts'),
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
				REGIONS_API_FUNCTION_NAME: props.regionsApiLambda.functionName,
				CONCURRENCY_LIMIT: props.concurrencyLimit.toString(),
				QUEUE_URL: props.engineQueue.queueUrl,
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
		eventBus.grantPutEventsTo(apiLambda);
		props.engineQueue.grantSendMessages(apiLambda);
		props.regionsApiLambda.grantInvoke(apiLambda);

		/**
		 * Define the APIGW Authorizer
		 */
		const authorizerLambda = new NodejsFunction(this, 'ExecutorApiAuthorizerLambda', {
			functionName: `${namePrefix}-executorApi-authorizer`,
			description: `AGIE: Executor API Authorizer: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/executor/src/lambda_authorizer.ts'),
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

		authorizerLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['verifiedpermissions:IsAuthorizedWithToken'],
				resources: [`arn:aws:verifiedpermissions::${account}:policy-store/${props.policyStoreId}`],
			})
		);

		/**
		 * Define the API Gateway
		 */
		const authorizer = new RequestAuthorizer(this, 'Authorizer', {
			handler: authorizerLambda,
			identitySources: [IdentitySource.header('Authorization'), IdentitySource.context('path'), IdentitySource.context('httpMethod')],
		});

		const logGroup = new LogGroup(this, 'ExecutorApiLogs');
		const apigw = new LambdaRestApi(this, 'ExecutorApiGateway', {
			restApiName: `${namePrefix}-executor`,
			description: `AGIE: Executor API: ${props.environment}`,
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

		new StringParameter(this, 'ExecutorApiUrlParameter', {
			parameterName: executorApiUrlParameter(props.environment),
			stringValue: apigw.url,
		});

		new StringParameter(this, 'ExecutorApiNameParameter', {
			parameterName: executorApiNameParameter(props.environment),
			stringValue: apigw.restApiName,
		});

		NagSuppressions.addResourceSuppressions(
			[sqsProcessorLambda],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<engineApiFunctionArnParameter>:*', `Resource::arn:aws:batch:${region}:${account}:job-definition/*`],
					reason: 'SQS processor lambda needs to invoke engine API to retrieve AWS Batch Job Definition ARN.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[sqsProcessorLambda, eventbridgeLambda, apiLambda],
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
					appliesTo: ['Resource::<regionsApiFunctionArnParameter>:*', 'Resource::<resultsApiFunctionArnParameter>:*'],
					reason: 'SQS processor lambda needs to invoke the regions api to retrieve list of polygons by region.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [
						'Action::s3:Abort*',
						'Action::s3:DeleteObject*',
						'Action::s3:GetBucket*',
						'Action::s3:GetObject*',
						'Action::s3:List*',
						'Resource::<ExecutorModuleTable7F728234.Arn>/index/*',
						'Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*',
					],
					reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.',
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
			[executorEventBridgeHandlerDLQ],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.',
				},
			],
			true
		);
	}
}

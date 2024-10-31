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
import { REGIONS_EVENT_SOURCE, REGIONS_REGION_CREATED_EVENT, REGIONS_REGION_DELETED_EVENT, REGIONS_REGION_UPDATED_EVENT } from '@agie/events';
import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ITable, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IFunction, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { FilterOrPolicy, SubscriptionFilter, Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScheduledConstructProperties {
	readonly environment: string;
	readonly eventBusName: string;
	readonly bucketName: string;
	readonly sentinelTopicArn: string;
	readonly stacApiEndpoint: string;
	readonly stacApiResourceArn: string;
	readonly regionsApiLambda: IFunction;
	readonly resultsApiLambda: IFunction;
	readonly sentinelApiUrl: string;
	readonly sentinelCollection: string;
}

const schedulerGroupNameParameter = (environment: string) => `/agie/${environment}/scheduler/groupName`;
const schedulerTableNameParameter = (environment: string) => `/agie/${environment}/scheduler/tableName`;
const schedulerTableArnParameter = (environment: string) => `/agie/${environment}/scheduler/tableArn`;
const engineSQSQueueUrlParameter = (environment: string) => `/agie/${environment}/scheduler/engineSQSQueueUrl`;

export class SchedulerModule extends Construct {
	public engineQueue: IQueue;
	public table: ITable;

	constructor(scope: Construct, id: string, props: ScheduledConstructProperties) {
		super(scope, id);

		const account = Stack.of(this).account;
		const region = cdk.Stack.of(this).region;

		const namePrefix = `agie-${props.environment}`;

		const eventBus = EventBus.fromEventBusName(scope, 'EventBus', props.eventBusName);

		const topic = Topic.fromTopicArn(this, 'Sentinel2Topic', props.sentinelTopicArn);

		// DynamoDb Table
		const table = new Table(this, 'Table', {
			tableName: `${namePrefix}-scheduler`,
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
			timeToLiveAttribute: 'ttl',
		});

		this.table = table;

		new StringParameter(this, `SchedulerTableNameParameter`, {
			parameterName: schedulerTableNameParameter(props.environment),
			stringValue: table.tableName,
		});

		new StringParameter(this, `SchedulerTableArnParameter`, {
			parameterName: schedulerTableArnParameter(props.environment),
			stringValue: table.tableArn,
		});

		/**
		 * This is the queue that the scheduler will publish to when a new processing task available for a region
		 */
		const engineDlq = new Queue(this, `taskDlq`, {
			queueName: `${namePrefix}-engine-dlq.fifo`,
			fifo: true,
		});

		engineDlq.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [engineDlq.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		this.engineQueue = new Queue(this, `taskQueue`, {
			queueName: `${namePrefix}-engine-queue.fifo`,
			fifo: true,
			contentBasedDeduplication: true,
			deadLetterQueue: {
				maxReceiveCount: 10,
				queue: engineDlq,
			},
			visibilityTimeout: Duration.minutes(2),
		});

		new StringParameter(this, 'engineSQSQueueUrlParameter', {
			parameterName: engineSQSQueueUrlParameter(props.environment),
			stringValue: this.engineQueue.queueUrl,
		});

		this.engineQueue.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [this.engineQueue.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		/**
		 * This is the queue that subscribes to the SNS topic hosted by element84
		 * https://registry.opendata.aws/sentinel-2-l2a-cogs/
		 */
		const sentinelDlq = new Queue(this, `SentinelDLQ`, { queueName: `${namePrefix}-sentinel-dlq` });
		sentinelDlq.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [sentinelDlq.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		const sentinelQueue = new Queue(this, `SentinelQueue`, {
			queueName: `${namePrefix}-sentinel-queue`,
			deadLetterQueue: {
				maxReceiveCount: 10,
				queue: sentinelDlq,
			},
			visibilityTimeout: Duration.minutes(2),
		});

		sentinelQueue.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [sentinelQueue.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		// create subscription to the Sentinel topics
		topic.addSubscription(
			new SqsSubscription(sentinelQueue, {
				rawMessageDelivery: true,
				filterPolicyWithMessageBody: {
					collection: FilterOrPolicy.filter(
						SubscriptionFilter.stringFilter({
							// only subscribed to cloud optimized sentinel images update
							allowlist: ['sentinel-2-c1-l2a'],
						})
					),
				},
			})
		);

		const eventBridgeSchedulerLambda = new NodejsFunction(this, 'EventBridgeSchedulerLambda', {
			description: 'Scheduler module EventBridge Scheduler lambda',
			entry: path.join(__dirname, '../../../typescript/packages/apps/scheduler/src/lambda_eventbridge_scheduler.ts'),
			functionName: `${namePrefix}-scheduler-eventbridge-scheduler-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				BUCKET_NAME: props.bucketName,
				STAC_API_ENDPOINT: props.stacApiEndpoint,
				REGIONS_API_FUNCTION_NAME: props.regionsApiLambda.functionName,
				RESULTS_API_FUNCTION_NAME: props.resultsApiLambda.functionName,
				QUEUE_URL: this.engineQueue.queueUrl,
				ENVIRONMENT: props.environment,
				SENTINEL_API_URL: props.sentinelApiUrl,
				SENTINEL_COLLECTION: props.sentinelCollection,
				TABLE_NAME: table.tableName,
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

		table.grantReadWriteData(eventBridgeSchedulerLambda);
		this.engineQueue.grantSendMessages(eventBridgeSchedulerLambda);
		props.regionsApiLambda.grantInvoke(eventBridgeSchedulerLambda);
		props.resultsApiLambda.grantInvoke(eventBridgeSchedulerLambda);

		// Lambda function that processor schedule queued in SQS
		const sqsProcessorLambda = new NodejsFunction(this, 'SqsProcessorLambda', {
			description: 'Scheduler module sentinel sqs processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/scheduler/src/lambda_sqs.ts'),
			functionName: `${namePrefix}-scheduler-sqs-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(2),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				BUCKET_NAME: props.bucketName,
				STAC_API_ENDPOINT: props.stacApiEndpoint,
				REGIONS_API_FUNCTION_NAME: props.regionsApiLambda.functionName,
				RESULTS_API_FUNCTION_NAME: props.resultsApiLambda.functionName,
				QUEUE_URL: this.engineQueue.queueUrl,
				ENVIRONMENT: props.environment,
				SENTINEL_API_URL: props.sentinelApiUrl,
				SENTINEL_COLLECTION: props.sentinelCollection,
				TABLE_NAME: table.tableName,
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

		table.grantReadWriteData(sqsProcessorLambda);
		this.engineQueue.grantSendMessages(sqsProcessorLambda);
		props.regionsApiLambda.grantInvoke(sqsProcessorLambda);
		props.resultsApiLambda.grantInvoke(sqsProcessorLambda);
		sqsProcessorLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['execute-api:Invoke'],
				effect: Effect.ALLOW,
				resources: [props.stacApiResourceArn],
			})
		);

		sqsProcessorLambda.addEventSource(
			new SqsEventSource(sentinelQueue, {
				maxBatchingWindow: Duration.minutes(1),
				batchSize: 50,
				reportBatchItemFailures: true,
			})
		);

		/**
		 * This is the eventbridge scheduler configured for a region (in a scheduled processing mode).
		 * It will publish the scheduled event to the engine queue explained above.
		 */
		const cfnScheduleGroup = new CfnScheduleGroup(this, 'AgieScheduleGroup', {
			name: `${namePrefix}-scheduler`,
		});

		const agieSchedulerRole = new Role(this, 'AgieSchedulerRole', {
			assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
		});

		new StringParameter(this, 'schedulerGroupNameParameter', {
			parameterName: schedulerGroupNameParameter(props.environment),
			stringValue: cfnScheduleGroup.name,
		});

		// Lambda function that processor schedule queued in SQS
		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			description: 'Scheduler module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/scheduler/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-scheduler-eventbridge-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				SCHEDULER_GROUP: cfnScheduleGroup.name,
				SQS_ARN: this.engineQueue.queueArn,
				EVENTBRIDGE_LAMBDA_FUNCTION_ARN: eventBridgeSchedulerLambda.functionArn,
				ROLE_ARN: agieSchedulerRole.roleArn,
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

		eventBridgeSchedulerLambda.grantInvoke(agieSchedulerRole);
		// Allow eventbridge lambda role to perform crud on engine run data
		table.grantReadWriteData(eventbridgeLambda);
		// Allow eventbridge lambda role to pass scheduler rule when creating schedule
		agieSchedulerRole.grantPassRole(eventbridgeLambda.role);
		eventBus.grantPutEventsTo(eventbridgeLambda);
		// Allow eventbridge lambda to create scheduler rule
		eventbridgeLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['scheduler:CreateSchedule', 'scheduler:UpdateSchedule', 'scheduler:DeleteSchedule', 'scheduler:GetSchedule'],
				effect: Effect.ALLOW,
				resources: ['*'],
			})
		);

		eventbridgeLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['scheduler:ListScheduleGroups', 'scheduler:GetScheduleGroup'],
				effect: Effect.ALLOW,
				resources: [cfnScheduleGroup.attrArn],
			})
		);

		const schedulerEventBridgeHandlerDLQ = new Queue(this, 'SchedulerEventBridgeHandlerDLQ');

		schedulerEventBridgeHandlerDLQ.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [schedulerEventBridgeHandlerDLQ.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

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

		regionModifiedRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: schedulerEventBridgeHandlerDLQ,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2,
			})
		);

		NagSuppressions.addResourceSuppressions(
			[agieSchedulerRole],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<SchedulerModuleEventBridgeSchedulerLambdaE1519610.Arn>:*'],
					reason: 'This role will be assumed by EventBridge scheduler to invoke the lambda.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[eventbridgeLambda, sqsProcessorLambda, eventBridgeSchedulerLambda],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [
						'Resource::*',
						'Resource::<regionsApiFunctionArnParameter>:*',
						'Resource::<resultsApiFunctionArnParameter>:*',
						'Resource::<SchedulerModuleTableDD17B520.Arn>/index/*',
						`Resource::arn:<AWS::Partition>:execute-api:${region}:${account}:<StacServerModuleStacApiGateway48C0D803>/*/*/*`,
					],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[engineDlq, schedulerEventBridgeHandlerDLQ, sentinelDlq],
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

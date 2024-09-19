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

import { Construct } from "constructs";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import path from "path";
import { Function, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Aspects, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { getLambdaArchitecture } from "@agie/cdk-common";
import { EXECUTOR_EVENT_SOURCE, EXECUTOR_JOB_CREATED_EVENT, EXECUTOR_JOB_UPDATED_EVENT } from "@agie/events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { fileURLToPath } from "url";
import { NagSuppressions } from "cdk-nag";
import { AnyPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from "aws-cdk-lib/aws-dynamodb";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
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
	RequestAuthorizer
} from "aws-cdk-lib/aws-apigateway";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notificationsTableNameParameter = (environment: string) => `/agie/${environment}/notifications/tableName`;
const notificationsTableArnParameter = (environment: string) => `/agie/${environment}/notifications/tableArn`;
export const notificationsApiFunctionArnParameter = (environment: string) => `/agie/${environment}/notifications/apiFunctionArn`;
export const notificationsApiUrlParameter = (environment: string) => `/agie/${environment}/notifications/apiUrl`;
export const notificationsApiNameParameter = (environment: string) => `/agie/${environment}/notifications/apiName`;

const notificationsApiAuthorizerFunctionArnParameter = (environment: string) => `/agie/${environment}/notifications/verifiedPermissionsAuthorizerFunctionArn`;

export interface NotificationsConstructProperties {
	environment: string;
	cognitoUserPoolId: string;
	eventBusName: string;
	bucketName: string;
	regionsApiFunctionArn: string;
	readonly cognitoClientId: string;
	readonly policyStoreId: string;
}

export class NotificationsModule extends Construct {

	constructor(scope: Construct, id: string, props: NotificationsConstructProperties) {
		super(scope, id);

		const namePrefix = `agie-${props.environment}`;
		const eventBus = EventBus.fromEventBusName(this, 'EventBus', props.eventBusName);
		const accountId = Stack.of(this).account;

		const regionsApiLambda = Function.fromFunctionArn(scope, 'RegionsApiFunction', props.regionsApiFunctionArn);

		// DynamoDb Table
		const table = new Table(this, 'Table', {
			tableName: `${namePrefix}-notifications`,
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


		new StringParameter(this, `NotificationsTableNameParameter`, {
			parameterName: notificationsTableNameParameter(props.environment),
			stringValue: table.tableName,
		});

		new StringParameter(this, `NotificationsTableArnParameter`, {
			parameterName: notificationsTableArnParameter(props.environment),
			stringValue: table.tableArn,
		});

		/**
		 * Define the API Lambda
		 */
		const apiLambda = new NodejsFunction(this, 'NotificationsApiLambda', {
			functionName: `${namePrefix}-notificationsApi`,
			description: `AGIE: Notifications API: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/notifications/src/lambda_apiGateway.ts'),
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
				AWS_ACCOUNT_ID: accountId,
				REGIONS_API_FUNCTION_NAME: regionsApiLambda.functionName,
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

		regionsApiLambda.grantInvoke(apiLambda);
		table.grantReadWriteData(apiLambda)
		eventBus.grantPutEventsTo(apiLambda);
		apiLambda.addToRolePolicy(new PolicyStatement({
			actions: [
				'sns:CreateTopic',
				'sns:GetTopicAttributes',
				'sns:ListSubscriptionsByTopic',
				'sns:Subscribe',
				'sns:Unsubscribe',
				'sns:ListSubscriptionsByTopic',
				'sns:DeleteTopic',
			],
			effect: Effect.ALLOW,
			resources: ['*'],
		}))

		// Grant query on table index
		apiLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:Query'],
				effect: Effect.ALLOW,
				resources: [table.tableArn, `${table.tableArn}/index/*`],
			})
		);

		new StringParameter(this, 'NotificationsApiFunctionArnParameter', {
			parameterName: notificationsApiFunctionArnParameter(props.environment),
			stringValue: apiLambda.functionArn,
		});

		/**
		 * Define the APIGW Authorizer
		 */
		const authorizerLambda = new NodejsFunction(this, 'ResultsApiAuthorizerLambda', {
			functionName: `${namePrefix}-notificationsApi-authorizer`,
			description: `AGIE: Notifications API Authorizer: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/notifications/src/lambda_authorizer.ts'),
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
				resources: [`arn:aws:verifiedpermissions::${accountId}:policy-store/${props.policyStoreId}`],
			})
		);

		new StringParameter(this, 'notificationsApiAuthorizerFunctionArnParameter', {
			parameterName: notificationsApiAuthorizerFunctionArnParameter(props.environment),
			stringValue: authorizerLambda.functionArn,
		});


		/**
		 * Define the API Gateway
		 */
		const authorizer = new RequestAuthorizer(this, 'Authorizer', {
			handler: authorizerLambda,
			identitySources: [IdentitySource.header('Authorization'), IdentitySource.context('path'), IdentitySource.context('httpMethod')],
		});

		const logGroup = new LogGroup(this, 'NotificationsApiLogs');

		const apigw = new LambdaRestApi(this, 'NotificationsApiGateway', {
			restApiName: `${namePrefix}-notifications`,
			description: `AGIE: Notifications API: ${props.environment}`,
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

		new StringParameter(this, 'NotificationsApiUrlParameter', {
			parameterName: notificationsApiUrlParameter(props.environment),
			stringValue: apigw.url,
		});

		new StringParameter(this, 'NotificationsApiNameParameter', {
			parameterName: notificationsApiNameParameter(props.environment),
			stringValue: apigw.restApiName,
		});


		/**
		 * Define the EventBridge lambda that will create the daily schedule when a region is created
		 */
		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			description: 'Scheduler module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/notifications/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-notifications-eventbridge-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				AWS_ACCOUNT_ID: accountId,
				TABLE_NAME: table.tableName,
				EVENT_BUS_NAME: props.eventBusName,
				BUCKET_NAME: props.bucketName,
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
		// Allow eventbridge lambda role to pass scheduler rule when creating schedule
		eventBus.grantPutEventsTo(eventbridgeLambda);

		// Grant query on table index
		eventbridgeLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:Query'],
				effect: Effect.ALLOW,
				resources: [table.tableArn, `${table.tableArn}/index/*`],
			})
		);

		eventbridgeLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['sns:Publish'],
				effect: Effect.ALLOW,
				resources: ['*'],
			})
		);


		const notificationsEventBridgeDLQ = new Queue(this, 'EventBridgeRuleDlQ', { queueName: `${namePrefix}-notifications-eventbridge-dlq` });

		notificationsEventBridgeDLQ.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [notificationsEventBridgeDLQ.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		const jobModifiedRule = new Rule(this, 'JobModifiedRule', {
			eventBus: eventBus,
			eventPattern: {
				detailType: [
					EXECUTOR_JOB_UPDATED_EVENT,
					EXECUTOR_JOB_CREATED_EVENT,
				],
				source: [EXECUTOR_EVENT_SOURCE],
			},
		});

		jobModifiedRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: notificationsEventBridgeDLQ,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2,
			})
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
			[eventbridgeLambda, apiLambda],
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
			[apiLambda, eventbridgeLambda],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<NotificationsModuleTableEF0736FF.Arn>/index/*', 'Resource::<regionsApiFunctionArnParameter>:*'],
					reason: 'Lambda needs to query the DynamoDB table.',
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[notificationsEventBridgeDLQ],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.',
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

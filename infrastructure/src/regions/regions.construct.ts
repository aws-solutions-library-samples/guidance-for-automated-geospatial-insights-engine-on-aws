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

import { getLambdaArchitecture } from '@arcade/cdk-common';
import { Aspects, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { AccessLogFormat, AuthorizationType, CfnMethod, CognitoUserPoolsAuthorizer, Cors, EndpointType, LambdaRestApi, LogGroupLogDestination, MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
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
	eventBusName: string;
}

export const regionsApiFunctionArnParameter = (environment: string) => `/arcade/${environment}/regions/apiFunctionArn`;
export const regionsApiUrlParameter = (environment: string) => `/arcade/${environment}/regions/apiUrl`;
export const regionsApiNameParameter = (environment: string) => `/arcade/${environment}/regions/apiName`;
const regionsTableNameParameter = (environment: string) => `/arcade/${environment}/regions/tableName`;
const regionsTableArnParameter = (environment: string) => `/arcade/${environment}/regions/tableArn`;

export class RegionsModule extends Construct {
	public regionsFunctionName: string;
	tableName: string;

	constructor(scope: Construct, id: string, props: RegionsConstructProperties) {
		super(scope, id);

		const namePrefix = `arcade-${props.environment}`;

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
		 * Define the API Lambda
		 */
		const apiLambda = new NodejsFunction(this, 'RegionsApiLambda', {
			functionName: `${namePrefix}-regionsApi`,
			description: `ARCADE: Regions API: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/regions/src/lambda_apiGateway.ts'),
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			timeout: Duration.seconds(29),
			logRetention: RetentionDays.ONE_WEEK,
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				ENVIRONMENT: props.environment,
				NODE_ENV: 'cloud',
				TABLE_NAME: this.tableName,
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

		apiLambda.node.addDependency(table);

		this.regionsFunctionName = apiLambda.functionName;

		new StringParameter(this, 'regionsApiFunctionArnParameter', {
			parameterName: regionsApiFunctionArnParameter(props.environment),
			stringValue: apiLambda.functionArn,
		});

		// lambda permissions
		table.grantWriteData(apiLambda);
		table.grantReadData(apiLambda);
		// deny apiLambda accidental full table scans on table seeing as PartiQL is used
		apiLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['dynamodb:Scan'],
				effect: Effect.DENY,
				resources: [table.tableArn],
			}
			));


		eventBus.grantPutEventsTo(apiLambda);

		/**
		 * Define the API Gateway
		 */

		const userPool = UserPool.fromUserPoolId(this, 'UserPool', props.cognitoUserPoolId);

		const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
			cognitoUserPools: [userPool],
		});

		// TODO: wire up verified permissions

		const logGroup = new LogGroup(this, 'RegionsApiLogs');
		const apigw = new LambdaRestApi(this, 'RegionsApiGateway', {
			restApiName: `${namePrefix}-regions`,
			description: `ARCADE: Regions API: ${props.environment}`,
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
				authorizationType: AuthorizationType.COGNITO,
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

		NagSuppressions.addResourceSuppressions(
			[apiLambda],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Action::s3:Abort*', 'Action::s3:DeleteObject*', 'Action::s3:GetBucket*', 'Action::s3:GetObject*', 'Action::s3:List*', 'Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*'],
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

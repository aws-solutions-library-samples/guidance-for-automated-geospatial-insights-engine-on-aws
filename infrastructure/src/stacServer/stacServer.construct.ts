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

import { Aspects, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Code, Function, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { getLambdaArchitecture } from '@arcade/cdk-common';
import {
	AccessLogFormat,
	ApiKeySourceType,
	AuthorizationType,
	CfnMethod,
	Cors,
	EndpointType,
	LambdaRestApi,
	LogGroupLogDestination,
	MethodLoggingLevel
} from 'aws-cdk-lib/aws-apigateway';
import { AnyPrincipal, Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnDomain } from 'aws-cdk-lib/aws-opensearchservice';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CustomResource } from 'aws-cdk-lib/core';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StacServerConstructProperties {
	readonly environment: string;
	readonly instanceType: string;
	readonly volumeSize: number;
	readonly instanceCount: number;
	readonly volumeType: string;
}

export const stacServerOpenSearchUrlParameter = (environment: string) => `/arcade/${environment}/stacServer/openSearchUrl`;
export const stacServerApiUrlParameter = (environment: string) => `/arcade/${environment}/stacServer/apiUrl`;
export const stacServerAdministratorSecretNameParameter = (environment: string) => `/arcade/${environment}/stacServer/administratorSecretName`;

export class StacServerModule extends Construct {
	public stacServerEndpoint: string;
	public stacIngestTopicArn: string;
	public stacApiResourceArn: string;
	public stacApiEndpoint: string;

	constructor(scope: Construct, id: string, props: StacServerConstructProperties) {
		super(scope, id);

		const account = Stack.of(this).account;
		const region = Stack.of(this).region;

		const namePrefix = `arcade-${props.environment}`;
		const excludeCharacters = '"#%&\'()*,-./:;<=>@[\\]_`{|}~?';

		// This will be used by custom resource to initialise the OpenSearch server with resources required fo STAC
		const openSearchStacAdministrator = 'admin';
		const passwordField = 'password';
		const adminSecret = new Secret(this, 'OpenSearchSecret', {
			secretName: `${namePrefix}-admin-secret`,
			generateSecretString: {
				excludeCharacters: excludeCharacters,
				secretStringTemplate: JSON.stringify({ username: openSearchStacAdministrator }),
				generateStringKey: passwordField
			}
		});

		new StringParameter(this, 'AdministratorNameParameter', {
			parameterName: stacServerAdministratorSecretNameParameter(props.environment),
			stringValue: adminSecret.secretName
		});

		// This will be used by the application to query collection and items from stac server
		const openSearchStacUser = 'stac_server';
		const userSecret = new Secret(this, 'OpenSearchUserSecret', {
			secretName: `${namePrefix}-user-secret`,
			generateSecretString: {
				excludeCharacters: excludeCharacters,
				secretStringTemplate: JSON.stringify({ username: openSearchStacUser }),
				generateStringKey: passwordField
			}
		});

		const ingestTopic = new Topic(this, 'IngestTopic', {
			topicName: `${namePrefix}-stac-ingest`,
			enforceSSL: true
		});

		ingestTopic.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sns:Publish'],
				resources: [ingestTopic.topicArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false'
					}
				}
			})
		);

		this.stacIngestTopicArn = ingestTopic.topicArn;

		const ingestDlq = new Queue(this, 'IngestDlq', {
			queueName: `${namePrefix}-stac-ingest-dlq`,
			enforceSSL: true
		});

		ingestDlq.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [ingestDlq.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false'
					}
				}
			})
		);

		const ingestQueue = new Queue(this, 'IngestQueue', {
			visibilityTimeout: Duration.seconds(120),
			receiveMessageWaitTime: Duration.seconds(5),
			queueName: `${namePrefix}-stac-queue`,
			deadLetterQueue: {
				maxReceiveCount: 2,
				queue: ingestDlq
			}
		});

		ingestQueue.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [ingestQueue.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false'
					}
				}
			})
		);

		ingestTopic.addSubscription(
			new SqsSubscription(ingestQueue, {
				rawMessageDelivery: true
			})
		);

		const postIngestTopic = new Topic(this, 'PostIngestTopic', {
			topicName: `${namePrefix}-post-ingest`,
			enforceSSL: true
		});

		postIngestTopic.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sns:Publish'],
				resources: [postIngestTopic.topicArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false'
					}
				}
			})
		);

		/**
		 * Set up the OpenSearch domain and its related resources
		 */
		const domainName = `${namePrefix}-stac`;

		// add the environment postfix to ensure Log Resource Policy name is unique
		const searchSlowLoGroups = new LogGroup(this, `SearchSlowLogGroups${props.environment}`, {
			logGroupName: `/aws/OpenSearchService/domains/${namePrefix}-stac-server/search-slow-logs`,
			removalPolicy: RemovalPolicy.DESTROY
		});

		const addSearchSlowLogGroupsResult = searchSlowLoGroups.addToResourcePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('es.amazonaws.com')],
				actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
				resources: [`${searchSlowLoGroups.logGroupArn}:*`]
			})
		);

		// add the environment postfix to ensure Log Resource Policy name is unique
		const indexSlowLogsGroup = new LogGroup(this, `IndexSlowLogsGroup${props.environment}`, {
			logGroupName: `/aws/OpenSearchService/domains/${namePrefix}-stac-server/index-slow-logs`,
			removalPolicy: RemovalPolicy.DESTROY
		});

		const addIndexSlowLogGroupResult = indexSlowLogsGroup.addToResourcePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				principals: [new ServicePrincipal('es.amazonaws.com')],
				actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
				resources: [`${indexSlowLogsGroup.logGroupArn}:*`]
			})
		);

		const stacServerDomain = new CfnDomain(this, 'StacServerDomain', {
			domainName: domainName,
			ebsOptions: {
				ebsEnabled: true,
				volumeType: props.volumeType,
				volumeSize: props.volumeSize
			},
			clusterConfig: {
				instanceType: props.instanceType,
				instanceCount: props.instanceCount,
				dedicatedMasterEnabled: true,
				zoneAwarenessEnabled: true
			},
			engineVersion: 'OpenSearch_2.11',
			logPublishingOptions: {
				SEARCH_SLOW_LOGS: {
					enabled: true,
					cloudWatchLogsLogGroupArn: searchSlowLoGroups.logGroupArn
				},
				INDEX_SLOW_LOGS: {
					enabled: true,
					cloudWatchLogsLogGroupArn: indexSlowLogsGroup.logGroupArn
				}
			},
			domainEndpointOptions: {
				enforceHttps: true
			},
			nodeToNodeEncryptionOptions: {
				enabled: true
			},
			encryptionAtRestOptions: {
				enabled: true
			},
			advancedSecurityOptions: {
				enabled: true,
				internalUserDatabaseEnabled: true,
				masterUserOptions: {
					masterUserName: openSearchStacAdministrator,
					masterUserPassword: adminSecret.secretValueFromJson(passwordField).unsafeUnwrap()
				}
			},
			accessPolicies: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Principal: {
							AWS: '*'
						},
						Action: 'es:ESHttp*',
						Resource: `arn:aws:es:${region}:${account}:domain/${domainName}/*`
					}
				]
			}
		});

		stacServerDomain.node.addDependency(addIndexSlowLogGroupResult.policyDependable);
		stacServerDomain.node.addDependency(addSearchSlowLogGroupsResult.policyDependable);

		this.stacServerEndpoint = stacServerDomain.attrDomainEndpoint;
		new StringParameter(this, 'stacServerOpenSearchEndpointParameter', {
			parameterName: stacServerOpenSearchUrlParameter(props.environment),
			stringValue: stacServerDomain.attrDomainEndpoint
		});

		/**
		 * Define the Ingestion Lambda
		 */
		const stacIngestLambda = new Function(this, 'StacIngestLambda', {
			handler: 'index.handler',
			code: Code.fromAsset(path.join(__dirname, 'lambdas/ingest.zip')),
			functionName: `${namePrefix}-stac-ingest`,
			runtime: Runtime.NODEJS_20_X,
			memorySize: 512,
			timeout: Duration.minutes(1),
			environment: {
				STAC_ID: 'stac-server',
				STAC_TITLE: 'STAC API',
				STAC_DESCRIPTION: 'A STAC API using stac-server',
				LOG_LEVEL: 'debug',
				STAC_DOCS_URL: 'https://stac-utils.github.io/stac-server/',
				OPENSEARCH_HOST: stacServerDomain.attrDomainEndpoint,
				ENABLE_TRANSACTIONS_EXTENSION: 'false',
				OPENSEARCH_CREDENTIALS_SECRET_ID: adminSecret.secretName,
				STAC_API_ROOTPATH: '/prod',
				// This will be modified by the custom resource using the API gateway url
				STAC_API_URL: 'https://some-stac-server.com',
				POST_INGEST_TOPIC_ARN: postIngestTopic.topicArn
			}
		});

		ingestQueue.grantSendMessages(stacIngestLambda);
		ingestQueue.grantPurge(stacIngestLambda);
		ingestQueue.grantConsumeMessages(stacIngestLambda);
		postIngestTopic.grantPublish(stacIngestLambda);
		adminSecret.grantRead(stacIngestLambda);

		stacIngestLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['es:*'],
				resources: [`arn:aws:es:${region}:${account}:domain/${domainName}/*`]
			})
		);

		stacIngestLambda.addEventSource(
			new SqsEventSource(ingestQueue, {
				batchSize: 10,
				reportBatchItemFailures: true
			})
		);

		/**
		 * Define the Stac API lambda
		 */
		const stacApiLambda = new Function(this, 'StacApiLambda', {
			handler: 'index.handler',
			code: Code.fromAsset(path.join(__dirname, 'lambdas/api.zip')),
			functionName: `${namePrefix}-stac-api`,
			runtime: Runtime.NODEJS_20_X,
			memorySize: 1024,
			timeout: Duration.minutes(1),
			environment: {
				STAC_ID: 'stac-server',
				STAC_TITLE: 'STAC API',
				STAC_DESCRIPTION: 'A STAC API using stac-server',
				LOG_LEVEL: 'debug',
				STAC_DOCS_URL: 'https://stac-utils.github.io/stac-server/',
				ENABLE_TRANSACTIONS_EXTENSION: 'false',
				OPENSEARCH_CREDENTIALS_SECRET_ID: adminSecret.secretName,
				OPENSEARCH_HOST: stacServerDomain.attrDomainEndpoint,
				STAC_API_ROOTPATH: '/prod',
				// This will be modified by the custom resource using the API gateway url
				STAC_API_URL: 'https://some-stac-server.com'
			}
		});

		ingestQueue.grantSendMessages(stacApiLambda);
		ingestQueue.grantPurge(stacApiLambda);
		ingestQueue.grantConsumeMessages(stacApiLambda);
		postIngestTopic.grantPublish(stacApiLambda);
		adminSecret.grantRead(stacApiLambda);
		stacApiLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['es:*'],
				resources: [`arn:aws:es:${region}:${account}:domain/${domainName}/*`]
			})
		);

		/**
		 * Define the API Gateway and its related resources.
		 */
		const logGroup = new LogGroup(this, 'StacApiLogs');
		const apigw = new LambdaRestApi(this, 'StacApiGateway', {
			restApiName: `${namePrefix}-stac-server`,
			description: `ARCADE: Stac Server API: ${props.environment}`,
			handler: stacApiLambda,
			proxy: true,
			deployOptions: {
				stageName: 'prod',
				accessLogDestination: new LogGroupLogDestination(logGroup),
				accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
				loggingLevel: MethodLoggingLevel.INFO
			},
			defaultCorsPreflightOptions: {
				allowOrigins: Cors.ALL_ORIGINS,
				allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent', 'Accept-Version']
			},
			endpointTypes: [EndpointType.REGIONAL],
			apiKeySourceType: ApiKeySourceType.HEADER,
			defaultMethodOptions: {
				authorizationType: AuthorizationType.IAM
			}
		});

		this.stacApiEndpoint = apigw.url;

		new StringParameter(this, 'stacServerApiEndpointParameter', {
			parameterName: stacServerApiUrlParameter(props.environment),
			stringValue: apigw.url
		});

		this.stacApiResourceArn = apigw.arnForExecuteApi();

		Aspects.of(apigw).add({
			visit(node) {
				if (node instanceof CfnMethod && node.httpMethod === 'OPTIONS') {
					node.addPropertyOverride('AuthorizationType', 'NONE');
				}
			}
		});

		apigw.node.addDependency(stacApiLambda);

		/**
		 * Define the custom resource lambda containing the logic to initialize the OpenSearch server.
		 */
		const customResourceLambda = new NodejsFunction(this, 'CustomResourceLambda', {
			functionName: `${namePrefix}-stac-server-custom-resource`,
			description: `Stac Server Initializer for ${props.environment}.`,
			entry: path.join(__dirname, './lambdas/customResource.ts'),
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
				banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
				externalModules: ['pg-native']
			},
			environment: {
				ADMIN_SECRET_NAME: adminSecret.secretName,
				USER_SECRET_NAME: userSecret.secretName,
				STAC_ENDPOINT: stacServerDomain.attrDomainEndpoint,
				STAC_INGEST_LAMBDA: stacIngestLambda.functionName,
				INGESTION_TOPIC_ARN: ingestTopic.topicArn,
				STAC_ROLE_NAME: 'stac_server_role',
				STAC_API_LAMBDA: stacApiLambda.functionName,
				STAC_API_URL: apigw.url
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope)
		});

		adminSecret.grantRead(customResourceLambda);
		userSecret.grantRead(customResourceLambda);
		ingestTopic.grantPublish(customResourceLambda);
		stacIngestLambda.grantInvoke(customResourceLambda);
		customResourceLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['lambda:GetFunctionConfiguration', 'lambda:UpdateFunctionConfiguration'],
				resources: [stacApiLambda.functionArn, stacIngestLambda.functionArn]
			})
		);

		const customResourceProvider = new Provider(this, 'CustomResourceProvider', {
			onEventHandler: customResourceLambda
		});

		new CustomResource(this, 'StacServerCustomResource', {
			serviceToken: customResourceProvider.serviceToken,
			properties: {
				uniqueToken: Date.now()
			}
		});

		NagSuppressions.addResourceSuppressions(
			customResourceProvider,
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This only contains the policy the create and insert log to log group.'
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<StacServerModuleCustomResourceLambda45AAF369.Arn>:*'],
					reason: 'This only applies to the lambda defined in this construct and its versions.'
				},
				{
					id: 'AwsSolutions-L1',
					reason: 'The cr.Provider library is not maintained by this project.'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[customResourceLambda],
			[
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::<StacServerModuleStacIngestLambdaB7E642DF.Arn>:*`],
					reason: 'This policy is the one generated by CDK.'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[ingestTopic, postIngestTopic],
			[
				{
					id: 'AwsSolutions-SNS2',
					reason: 'Not required for now as the content of the topic can only be accessed if you have account access.'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[stacIngestLambda, stacApiLambda, customResourceLambda],
			[
				{
					id: 'AwsSolutions-L1',
					reason: 'Latest runtime not needed.'
				},
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.'
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*', 'Action::es:*', `Resource::arn:aws:es:${region}:${account}:domain/${domainName}/*`],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[adminSecret, userSecret],
			[
				{
					id: 'AwsSolutions-SMG4',
					reason: 'Lambda from Stac Server repository cannot handle secret rotation.'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[apigw],
			[
				{
					id: 'AwsSolutions-APIG2',
					reason: 'Request validation is being done by the Fastify module.'
				},
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'],
					reason: 'API GW needs this policy to push logs to cloudwatch.'
				},
				{
					id: 'AwsSolutions-APIG4',
					reason: 'OPTIONS has no auth.'
				},
				{
					id: 'AwsSolutions-COG4',
					reason: 'OPTIONS does not use Cognito auth.'
				}
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[stacServerDomain],
			[
				{
					id: 'AwsSolutions-OS1',
					reason: 'There are external applications that resides outside the VPC.'
				},
				{
					id: 'AwsSolutions-OS3',
					reason: 'This can be configured later by users to restrict the dashboard access to allowable IP.'
				},
				{
					id: 'AwsSolutions-OS4',
					reason: 'This is the default configuration of OpenSearch in StacServer repository.'
				},
				{
					id: 'AwsSolutions-OS5',
					reason: 'This is the default configuration of OpenSearch in StacServer repository.'
				},
				{
					id: 'AwsSolutions-OS7',
					reason: 'This is the default configuration of OpenSearch in StacServer repository.'
				}
			],
			true
		);
	}
}

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
import { IdentityPool, UserPoolAuthenticationProvider } from '@aws-cdk/aws-cognito-identitypool-alpha';
import * as cdk from 'aws-cdk-lib';
import { Duration, Stack } from 'aws-cdk-lib';
import { Cors } from 'aws-cdk-lib/aws-apigateway';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { IUserPoolClient, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, Handler, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { CfnMap } from 'aws-cdk-lib/aws-location';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';
import { userPoolClientIdParameter } from '../shared/cognito.construct.js';
import { StaticSite } from './ui.staticSite.construct.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UIConstructProperties {
	environment: string;
	cognitoUserPoolId: string;
	bucketName: string;
	stacApiEndpoint: string;
	stacApiResourceArn: string;
}

export const uiApiUrlParameter = (environment: string) => `/agie/${environment}/ui/apiUrl`;
export const uiApiIdParameter = (environment: string) => `/agie/${environment}/ui/apiId`;
export const uiCognitoClientIdParameter = (environment: string) => `/agie/${environment}/ui/cognitoClientId`;
export const uiIdentityPoolIdParameter = (environment: string) => `/agie/${environment}/ui/identityPoolId`;

export const uiBaseNavigationMapName = (environment: string) => `agie.${environment}.baseNavigationMap`;
export const uiBaseSatelliteMapName = (environment: string) => `agie.${environment}.baseSatelliteMap`;

export class UIModule extends Construct {
	readonly userPoolClient: IUserPoolClient;

	constructor(scope: Construct, id: string, props: UIConstructProperties) {
		super(scope, id);

		const namePrefix = `agie-${props.environment}`;
		const account = Stack.of(this).account;
		const region = cdk.Stack.of(this).region;
		/**
		 * API Lambda for the tiler
		 */
		const apiLambda = new Function(this, 'TilerApiLambda', {
			functionName: `${namePrefix}-tiler-api`,
			description: `AGIE: UI Tiler: ${props.environment}`,
			runtime: Runtime.FROM_IMAGE,
			tracing: Tracing.ACTIVE,
			code: Code.fromAssetImage(path.join(__dirname, '../../../python/apps/tiler/lambda'), {
				file: 'Dockerfile',
				buildArgs: {
					ENVIRONMENT: props.environment,
				},
			}),
			handler: Handler.FROM_IMAGE,
			memorySize: 1769,
			timeout: Duration.seconds(29),
			logRetention: RetentionDays.ONE_WEEK,
			environment: {
				ENVIRONMENT: props.environment,
				STAC_URL: props.stacApiEndpoint,
				ROOT_PATH: '/prod',
				GDAL_CACHEMAX: '200', // 200 mb
				GDAL_DISABLE_READDIR_ON_OPEN: 'EMPTY_DIR',
				GDAL_INGESTED_BYTES_AT_OPEN: '32768', // get more bytes when opening the files.
				GDAL_HTTP_MERGE_CONSECUTIVE_RANGES: 'YES',
				GDAL_HTTP_MULTIPLEX: 'YES',
				GDAL_HTTP_VERSION: '2',
				PYTHONWARNINGS: 'ignore',
				VSI_CACHE: 'TRUE',
				VSI_CACHE_SIZE: '5000000', // 5 MB (per file-handle)
			},
			architecture: getLambdaArchitecture(scope),
		});

		apiLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['execute-api:Invoke'],
				effect: Effect.ALLOW,
				resources: [props.stacApiResourceArn],
			})
		);

		/**
		 * Define the API Gateway
		 */

		const dataBucket = Bucket.fromBucketName(this, 'DataBucket', props.bucketName);
		dataBucket.grantRead(apiLambda);

		const userPool = UserPool.fromUserPoolId(this, 'UserPool', props.cognitoUserPoolId);

		const client = UserPoolClient.fromUserPoolClientId(this, 'UIClient', StringParameter.valueForStringParameter(this, userPoolClientIdParameter(props.environment)));

		const lambdaIntegration = new HttpLambdaIntegration('HttpLambdaIntegration', apiLambda);
		const userPoolAuthorizer = new HttpUserPoolAuthorizer('Authorizer', userPool, {
			userPoolClients: [client],
		});
		const httpApi = new HttpApi(this, 'HttpApi', {
			apiName: `${namePrefix}-ui-http-api`,
			corsPreflight: {
				allowOrigins: Cors.ALL_ORIGINS,
				allowMethods: [CorsHttpMethod.ANY],
				allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent', 'Accept-Version'],
			},
			createDefaultStage: false,
		});

		httpApi.addRoutes({
			path: '/{proxy+}',
			methods: [HttpMethod.DELETE, HttpMethod.GET, HttpMethod.HEAD, HttpMethod.PATCH, HttpMethod.POST, HttpMethod.PUT],
			integration: lambdaIntegration,
			authorizer: userPoolAuthorizer,
		});

		const prodStage = httpApi.addStage('ProdStage', {
			stageName: 'prod',
			autoDeploy: true,
		});

		const baseMap = new CfnMap(this, 'BaseMap', {
			configuration: {
				style: 'VectorEsriNavigation',
			},
			mapName: uiBaseNavigationMapName(props.environment),
		});

		const satelliteMap = new CfnMap(this, 'SatelliteMap', {
			configuration: {
				style: 'HybridHereExploreSatellite',
			},
			mapName: uiBaseSatelliteMapName(props.environment),
		});

		const mapUserIdentityPool = new IdentityPool(this, 'MapUserIdentityPool', {
			authenticationProviders: {
				userPools: [
					new UserPoolAuthenticationProvider({
						userPool: UserPool.fromUserPoolId(this, 'SharedUserPool', props.cognitoUserPoolId),
						userPoolClient: client,
					}),
				],
			},
			allowUnauthenticatedIdentities: false,
			allowClassicFlow: false,
		});

		mapUserIdentityPool.authenticatedRole.addToPrincipalPolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['geo:GetMapStyleDescriptor', 'geo:GetMapGlyphs', 'geo:GetMapSprites', 'geo:GetMapTile'],
				resources: [baseMap.attrArn, satelliteMap.attrArn],
			})
		);

		new StaticSite(this, 'Deployment', { environment: props.environment });

		new StringParameter(this, 'UIApiIdParameter', {
			parameterName: uiApiIdParameter(props.environment),
			stringValue: httpApi.apiId,
		});
		new StringParameter(this, 'UIApiUrlParameter', {
			parameterName: uiApiUrlParameter(props.environment),
			stringValue: prodStage.url,
		});
		new StringParameter(this, 'UICognitoClientIdParameter', {
			parameterName: uiCognitoClientIdParameter(props.environment),
			stringValue: client.userPoolClientId,
		});
		new StringParameter(this, 'UIIdentityPoolIdParameter', {
			parameterName: uiIdentityPoolIdParameter(props.environment),
			stringValue: mapUserIdentityPool.identityPoolId,
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
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
				},
				{
					id: 'AwsSolutions-L1',
					reason: 'The Titiler package recommends a specific python version (3.11).',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*', 'Action::s3:List*', 'Action::s3:GetObject*', 'Action::s3:GetBucket*', `Resource::arn:<AWS::Partition>:execute-api:${region}:${account}:<StacServerModuleStacApiGateway48C0D803>/*/*/*`],
					reason: 'Must read from entire bucket.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[httpApi],
			[
				{
					id: 'AwsSolutions-APIG1',
					reason: 'No logs configurable.',
				},
				{
					id: 'AwsSolutions-APIG4',
					reason: 'OPTIONS has no auth.',
				},
			],
			true
		);

		this.userPoolClient = client;
	}
}

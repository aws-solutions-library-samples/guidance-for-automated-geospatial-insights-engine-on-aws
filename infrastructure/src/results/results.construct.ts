import { getLambdaArchitecture } from '@arcade/cdk-common';
import {
	CLI_CATALOG_CREATE_EVENT,
	EXECUTOR_JOB_CREATED_EVENT,
	EXECUTOR_JOB_UPDATED_EVENT,
	EXECUTOR_POLYGON_METADATA_CREATED_EVENT,
	REGIONS_GROUP_CREATED_EVENT,
	REGIONS_GROUP_DELETED_EVENT,
	REGIONS_GROUP_UPDATED_EVENT,
	REGIONS_REGION_CREATED_EVENT,
	REGIONS_REGION_DELETED_EVENT,
	REGIONS_REGION_UPDATED_EVENT,
} from '@arcade/events';
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
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Function, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResultsConstructProperties {
	readonly environment: string;
	readonly eventBusName: string;
	readonly bucketName: string;
	readonly stacServerTopicArn: string;
	readonly stacServerUrl: string;
	readonly regionsApiFunctionArn: string;
	readonly cognitoUserPoolId: string;
	readonly cognitoClientId: string;
	readonly policyStoreId: string;
}

const resultsApiAuthorizerFunctionArnParameter = (environment: string) => `/arcade/${environment}/results/verifiedPermissionsAuthorizerFunctionArn`;
export const resultsApiFunctionArnParameter = (environment: string) => `/arcade/${environment}/results/apiFunctionArn`;
export const resultsApiUrlParameter = (environment: string) => `/arcade/${environment}/results/apiUrl`;
export const resultsApiNameParameter = (environment: string) => `/arcade/${environment}/results/apiName`;

export class ResultsModule extends Construct {
	public readonly tableName: string;
	public readonly tableArn: string;

	constructor(scope: Construct, id: string, props: ResultsConstructProperties) {
		super(scope, id);

		const account = Stack.of(this).account;
		const namePrefix = `arcade-staging`;
		const eventBus = EventBus.fromEventBusName(this, 'EventBus', props.eventBusName);
		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);
		const regionsApiLambda = Function.fromFunctionAttributes(scope, 'RegionsApiFunction', { functionArn: props.regionsApiFunctionArn, skipPermissions: true });
		const topic = Topic.fromTopicArn(this, 'StacServerArn', props.stacServerTopicArn);

		// DynamoDb Table
		const table = new Table(this, 'Table', {
			tableName: `${namePrefix}-results`,
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
			indexName: 'siKey1-sk-index',
			partitionKey: {
				name: 'siKey1',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'sk',
				type: AttributeType.STRING,
			},
			projectionType: ProjectionType.KEYS_ONLY,
		});

		this.tableName = table.tableName;
		this.tableArn = table.tableArn;

		/**
		 * Define the API Lambda
		 */
		const apiLambda = new NodejsFunction(this, 'ResultsApiLambda', {
			functionName: `${namePrefix}-resultsApi`,
			description: `ARCADE: Results API: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/results/src/lambda_apiGateway.ts'),
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

		new StringParameter(this, 'resultsApiFunctionArnParameter', {
			parameterName: resultsApiFunctionArnParameter(props.environment),
			stringValue: apiLambda.functionArn,
		});

		table.grantReadWriteData(apiLambda);
		eventBus.grantPutEventsTo(apiLambda);

		/**
		 * Define the APIGW Authorizer
		 */
		const authorizerLambda = new NodejsFunction(this, 'ResultsApiAuthorizerLambda', {
			functionName: `${namePrefix}-resultsApi-authorizer`,
			description: `ARCADE: Results API Authorizer: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/results/src/lambda_authorizer.ts'),
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

		new StringParameter(this, 'resultsApiAuthorizerFunctionArnParameter', {
			parameterName: resultsApiAuthorizerFunctionArnParameter(props.environment),
			stringValue: authorizerLambda.functionArn,
		});

		/**
		 * Define the API Gateway
		 */
		const authorizer = new RequestAuthorizer(this, 'Authorizer', {
			handler: authorizerLambda,
			identitySources: [IdentitySource.header('Authorization'), IdentitySource.context('path'), IdentitySource.context('httpMethod')],
		});

		const logGroup = new LogGroup(this, 'ResultsApiLogs');
		const apigw = new LambdaRestApi(this, 'ResultsApiGateway', {
			restApiName: `${namePrefix}-results`,
			description: `ARCADE: Results API: ${props.environment}`,
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

		new StringParameter(this, 'ResultsApiUrlParameter', {
			parameterName: resultsApiUrlParameter(props.environment),
			stringValue: apigw.url,
		});

		new StringParameter(this, 'ResultsApiNameParameter', {
			parameterName: resultsApiNameParameter(props.environment),
			stringValue: apigw.restApiName,
		});

		// EvenProcessor Lambda function
		const eventProcessorLambda = new NodejsFunction(this, 'EventProcessorLambda', {
			description: 'Results module event processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/results/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-event-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				TABLE_NAME: table.tableName,
				STAC_SERVER_TOPIC_ARN: topic.topicArn,
				STAC_SERVER_URL: props.stacServerUrl,
				REGIONS_FUNCTION_NAME: regionsApiLambda.functionName,
				BUCKET_NAME: bucket.bucketName,
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

		regionsApiLambda.grantInvoke(eventProcessorLambda);
		eventBus.grantPutEventsTo(eventProcessorLambda);
		table.grantReadWriteData(eventProcessorLambda);
		topic.grantPublish(eventProcessorLambda);
		bucket.grantRead(eventProcessorLambda);

		const deadLetterQueue = new Queue(this, 'DeadLetterQueue');
		deadLetterQueue.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [deadLetterQueue.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		NagSuppressions.addResourceSuppressions(
			[deadLetterQueue],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.',
				},
			],
			true
		);

		//Trigger Rule
		const resultsRule = new Rule(this, 'ResultsRule', {
			eventBus: eventBus,
			eventPattern: {
				detailType: [
					EXECUTOR_JOB_UPDATED_EVENT,
					EXECUTOR_JOB_CREATED_EVENT,
					// These events will trigger the creation/deletion of feature stac item
					EXECUTOR_POLYGON_METADATA_CREATED_EVENT,
					// These events will trigger the creation/deletion of group stac item
					REGIONS_GROUP_CREATED_EVENT,
					REGIONS_GROUP_UPDATED_EVENT,
					REGIONS_GROUP_DELETED_EVENT,
					// These events will trigger the creation/deletion of region stac item
					REGIONS_REGION_CREATED_EVENT,
					REGIONS_REGION_UPDATED_EVENT,
					REGIONS_REGION_DELETED_EVENT,
					// This events will trigger the creation of the catalog
					CLI_CATALOG_CREATE_EVENT,
				],
			},
		});

		resultsRule.addTarget(
			new LambdaFunction(eventProcessorLambda, {
				deadLetterQueue: deadLetterQueue,
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
			[eventProcessorLambda, apiLambda],
			[
				{
					id: 'AwsSolutions-L1',
					reason: 'Latest runtime not needed.',
				},
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [
						'Resource::*',
						'Action::s3:GetBucket*',
						'Action::s3:GetObject*',
						'Action::s3:List*',
						'Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*',
						'Resource::<regionsApiFunctionArnParameter>:*',
						'Resource::<ResultsModuleTable200422C7.Arn>/index/*',
					],
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

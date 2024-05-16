import { Construct } from 'constructs';
import { Duration, Stack } from 'aws-cdk-lib';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

import { getLambdaArchitecture } from '@arcade/cdk-common';
import path from 'path';
import { fileURLToPath } from 'url';
import { NagSuppressions } from 'cdk-nag';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StacServerConstructProperties {
	readonly environment: string;
	readonly openSearchEndpoint: string;
	readonly openSearchSecret: string;
	readonly cognitoUserPoolId: string;
	readonly cognitoClientId: string;
	readonly policyStoreId: string;
	readonly namePrefix: string;
	readonly authorizerFunctionName: string;
	readonly authorizerSecretId: string;
}

export class StacServerConstruct extends Construct {
	functionName: string;
	authorizerFunctionArn: string;
	authorizerFunctionName: string;
	constructor(scope: Construct, id: string, props: StacServerConstructProperties) {
		super(scope, id);

		const account = Stack.of(this).account;

		const openSearchSecret = Secret.fromSecretNameV2(this, 'openSearchSecret', props.openSearchSecret);
		const backendAuthorizerSecret = Secret.fromSecretNameV2(this, 'authorizerSecretId', props.authorizerSecretId);

		// Stac server initializer Lambda
		const stacServerInitializerLambda = new NodejsFunction(this, 'StacServerInitializerLambda', {
			description: 'Results module event processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/results/src/lambda_stacserver_init.ts'),
			functionName: `${props.namePrefix}-initializer`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(5),
			environment: {
				OPEN_SEARCH_ENDPOINT: props.openSearchEndpoint,
				OPEN_SEARCH_SECRET: openSearchSecret.secretName,
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

		openSearchSecret.grantRead(stacServerInitializerLambda);

		this.functionName = stacServerInitializerLambda.functionName;

		/**
		 * Define the Authorizer
		 */
		const authorizerLambda = new NodejsFunction(this, 'StacServerPreHookAuthorizerLambda', {
			functionName: `${props.authorizerFunctionName}`,
			description: `ARCADE: STAC server Prehook Authorizer: ${props.environment}`,
			entry: path.join(__dirname, '../../../typescript/packages/apps/results/src/lambda_stacServer_authorizer.ts'),
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
				BACKEND_AUTHORIZER_SECRET_ID: props.authorizerSecretId,
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});
		backendAuthorizerSecret.grantRead(authorizerLambda);

		authorizerLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['verifiedpermissions:IsAuthorizedWithToken'],
				resources: [`arn:aws:verifiedpermissions::${account}:policy-store/${props.policyStoreId}`],
			})
		);

		this.authorizerFunctionName = authorizerLambda.functionName;
		this.authorizerFunctionArn = authorizerLambda.functionArn;

		NagSuppressions.addResourceSuppressions(
			[stacServerInitializerLambda, authorizerLambda],
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
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
				},
			],
			true
		);
	}
}

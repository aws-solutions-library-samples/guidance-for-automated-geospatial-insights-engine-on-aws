import { getLambdaArchitecture } from '@arcade/cdk-common';
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CognitoIdpCreatorConstructProperties {
	userPoolIdParameter: string;
	samlMetaDataUrl: string;
	callbackUrls: string;
}

export const idpNameParameter = `/arcade/shared/ssoApplicationArnParameter`;
export const ssoApplicationMetadataUrlParameter = `/arcade/shared/MetadataUrlParameter`;
export const CognitoClientIdParameter = `/arcade/shared/cognito/clientId`;

export class CognitoIdpCreator extends Construct {
	private accountId = cdk.Stack.of(this).account;
	private region = cdk.Stack.of(this).region;

	constructor(scope: Construct, id: string, props: CognitoIdpCreatorConstructProperties) {
		super(scope, id);

		const namePrefix = `arcade`;

		new ssm.StringParameter(this, 'ssoApplicationMetadataUrlParameter', {
			parameterName: ssoApplicationMetadataUrlParameter,
			stringValue: props.samlMetaDataUrl,
		});
		const userPoolId = ssm.StringParameter.valueForStringParameter(this, props.userPoolIdParameter);

		// Below section is a custom resource that creates a cognito provider and client in SSO
		const customResourceLambda = new NodejsFunction(this, 'CognitoIdpCreatorLambda', {
			functionName: `${namePrefix}-cognito-idp-creator`,
			description: `Cognito idp creator for federated access`,
			entry: path.join(__dirname, './customResources/cognito.CustomResource.ts'),
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(5),
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
				USER_POOL_ID_PARAMETER: props.userPoolIdParameter,
				IDENTITY_PROVIDER_NAME_PARAMETER: idpNameParameter,
				METADATA_URL_PARAMETER: ssoApplicationMetadataUrlParameter,
				COGNITO_CLIENT_ID_PARAMETER: CognitoClientIdParameter,
				CALLBACK_URLS: props.callbackUrls,
			},
			depsLockFilePath: path.join(__dirname, '../../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		customResourceLambda.role?.addToPrincipalPolicy(
			new PolicyStatement({
				sid: 'federatedIdpSsm',
				effect: Effect.ALLOW,
				actions: ['ssm:GetParameter', 'ssm:PutParameter'],
				resources: [`arn:aws:ssm:${this.region}:${this.accountId}:*`],
			})
		);
		customResourceLambda.role?.addToPrincipalPolicy(
			new PolicyStatement({
				sid: 'CreateIdentityProvider',
				effect: Effect.ALLOW,
				actions: ['cognito-idp:CreateIdentityProvider', 'cognito-idp:DescribeIdentityProvider', 'cognito-idp:CreateUserPoolClient'],
				resources: [`arn:aws:cognito-idp:${this.region}:${this.accountId}:userpool/${userPoolId}`],
			})
		);

		const customResourceProvider = new cr.Provider(this, 'CustomResourceProvider', {
			onEventHandler: customResourceLambda,
		});

		new cdk.CustomResource(this, 'CustomResourceCognitoIdpCreator', {
			serviceToken: customResourceProvider.serviceToken,
			properties: {
				uniqueToken: Date.now(),
			},
		});

		NagSuppressions.addResourceSuppressions(
			customResourceProvider,
			[
				{
					id: 'AwsSolutions-IAM4',
					reason: 'This only contains the policy the create and insert log to log group.',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
				},
				{
					id: 'AwsSolutions-IAM5',
					reason: 'This only applies to the seeder lambda defined in this construct and its versions.',
					appliesTo: ['Resource::<CognitoIdpCreatorCognitoIdpCreatorLambda0153435B.Arn>:*'],
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::arn:aws:ssm:${this.region}:${this.accountId}:*`],
					reason: 'The resource condition allows performing GetSSMParameter calls.',
				},
			],
			true
		);
		// 	End of legacy code

		NagSuppressions.addResourceSuppressions(
			[customResourceLambda],
			[
				{
					id: 'AwsSolutions-IAM4',
					reason: 'This only contains the policy the create and insert log to log group.',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
				},

				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [`Resource::arn:aws:ssm:${this.region}:${this.accountId}:*`],
					reason: 'The resource condition allows performing Get SSMParameter calls.',
				},
			],
			true
		);
	}
}

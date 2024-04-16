import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {
	AccountRecovery,
	CfnUserPoolGroup,
	CfnUserPoolUser,
	CfnUserPoolUserToGroupAttachment,
	ClientAttributes,
	StandardAttributesMask,
	StringAttribute,
	UserPool,
	UserPoolClient,
	UserPoolClientIdentityProvider,
	UserPoolDomain,
	UserPoolEmail,
} from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface CognitoConstructProperties {
	environment: string;
	administratorEmail: string;
	userPoolEmail?: {
		fromEmail: string;
		fromName: string;
		replyTo: string;
		sesVerifiedDomain: string;
	};
}

export const userPoolIdParameter = (environment: string) => `/arcade/${environment}/shared/cognitoUserPoolId`;
export const userPoolArnParameter = (environment: string) => `/arcade/${environment}/shared/cognitoUserPoolArn`;
export const userPoolClientIdParameter = (environment: string) => `/arcade/${environment}/shared/cognitoUserPoolClientId`;
export const userPoolDomainParameter = (environment: string) => `/arcade/${environment}/shared/cognitoUserPoolDomain`;
export const adminUserParameter = (environment: string) => `/arcade/${environment}/shared/cognitoAdminUser`;

export class Cognito extends Construct {
	public readonly userPoolId: string;

	constructor(scope: Construct, id: string, props: CognitoConstructProperties) {
		super(scope, id);

		const namePrefix = `arcade-${props.environment}`;

		const userPoolEmailSettings: UserPoolEmail | undefined = props.userPoolEmail
			? cognito.UserPoolEmail.withSES({
					fromEmail: props.userPoolEmail.fromEmail,
					fromName: props.userPoolEmail.fromName,
					replyTo: props.userPoolEmail.replyTo,
					sesVerifiedDomain: props.userPoolEmail.sesVerifiedDomain,
					sesRegion: cdk.Stack.of(this).region,
			  })
			: undefined;

		/**
		 * Create and configure the Cognito user pool
		 */
		const userPool = new UserPool(this, 'UserPool', {
			userPoolName: namePrefix,
			email: userPoolEmailSettings,
			selfSignUpEnabled: false,
			signInAliases: {
				email: true,
			},
			autoVerify: {
				email: true,
			},
			customAttributes: {
				role: new StringAttribute({ mutable: true }),
			},
			passwordPolicy: {
				minLength: 6,
				requireLowercase: true,
				requireDigits: true,
				requireUppercase: false,
				requireSymbols: false,
			},
			accountRecovery: AccountRecovery.EMAIL_ONLY,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		NagSuppressions.addResourceSuppressions(
			userPool,
			[
				{
					id: 'AwsSolutions-COG3',
					reason: 'User can turn on AdvancedSecurity mode if they want to, the open source solution will not enforce it.',
				},
				{
					id: 'AwsSolutions-COG1',
					reason: 'User can modify the password policy as necessary.',
				},
			],
			true
		);

		this.userPoolId = userPool.userPoolId;

		new ssm.StringParameter(this, 'cognitoUserPoolIdParameter', {
			parameterName: userPoolIdParameter(props.environment),
			stringValue: userPool.userPoolId,
		});

		new ssm.StringParameter(this, 'cognitoUserPoolArnParameter', {
			parameterName: userPoolArnParameter(props.environment),
			stringValue: userPool.userPoolArn,
		});

		const domain = new UserPoolDomain(this, 'UserPoolDomain', {
			userPool: userPool,
			cognitoDomain: {
				domainPrefix: `${namePrefix}-${cdk.Stack.of(this).account}`,
			},
		});

		new ssm.StringParameter(this, 'userPoolDomainParameter', {
			parameterName: userPoolDomainParameter(props.environment),
			stringValue: domain.domainName,
		});

		// TODO: email via SES
		// const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
		// cfnUserPool.emailConfiguration = {
		//   emailSendingAccount: 'DEVELOPER',
		//   replyToEmailAddress: 'YOUR_EMAIL@example.com',
		//   sourceArn: `arn:aws:ses:cognito-ses-region:${
		//     cdk.Stack.of(this).account
		//   }:identity/YOUR_EMAIL@example.com`,
		// };

		// 👇 User Pool Client attributes for end users
		const standardCognitoAttributes: StandardAttributesMask = {
			email: true,
			emailVerified: true,
		};

		const clientReadAttributes = new ClientAttributes().withStandardAttributes(standardCognitoAttributes);

		const clientWriteAttributes = new ClientAttributes().withStandardAttributes({
			...standardCognitoAttributes,
			emailVerified: false,
		});

		// 👇 User Pool Client for end users
		const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
			userPool,
			authFlows: {
				adminUserPassword: true,
				userSrp: true,
			},
			supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
			readAttributes: clientReadAttributes,
			writeAttributes: clientWriteAttributes,
		});
		userPoolClient.node.addDependency(userPool);

		new ssm.StringParameter(this, 'cognitoClientIdParameter', {
			parameterName: userPoolClientIdParameter(props.environment),
			stringValue: userPoolClient.userPoolClientId,
		});

		/**
		 * Seed the default roles as groups
		 */

		const adminGroup = new CfnUserPoolGroup(this, 'GlobalAdminGroup', {
			groupName: 'admin',
			userPoolId: userPool.userPoolId,
		});
		adminGroup.node.addDependency(userPool);

		const contributorGroup = new CfnUserPoolGroup(this, 'GlobalContributorGroup', {
			groupName: 'contributor',
			userPoolId: userPool.userPoolId,
		});
		contributorGroup.node.addDependency(userPool);

		const readerGroup = new CfnUserPoolGroup(this, 'GlobalReaderGroup', {
			groupName: 'reader',
			userPoolId: userPool.userPoolId,
		});
		readerGroup.node.addDependency(userPool);

		/**
		 * Seed the initial admin user
		 */
		const adminUser = new CfnUserPoolUser(this, 'GlobalAdminUser', {
			userPoolId: userPool.userPoolId,
			username: props.administratorEmail,
			userAttributes: [
				{
					name: 'email',
					value: props.administratorEmail,
				},
			],
		});
		adminUser.node.addDependency(userPool);

		const membership = new CfnUserPoolUserToGroupAttachment(this, 'AdminUserGroupMembership', {
			groupName: adminGroup.groupName as string,
			username: adminUser.username as string,
			userPoolId: userPool.userPoolId,
		});

		membership.node.addDependency(adminGroup);
		membership.node.addDependency(adminUser);
		membership.node.addDependency(userPool);

		new ssm.StringParameter(this, 'adminUserParameter', {
			parameterName: adminUserParameter(props.environment),
			stringValue: props.administratorEmail,
		});
	}
}

import { Bus, userPoolIdParameter } from '@arcade/cdk-common';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { Cognito } from './cognito.construct.js';
import { S3, bucketArnParameter, bucketNameParameter } from './s3.construct.js';

export type SharedStackProperties = StackProps & {
	environment: string;
	administratorEmail: string;
	userPoolEmail?: {
		fromEmail: string;
		fromName: string;
		replyTo: string;
		sesVerifiedDomain: string;
	};
	deleteBucket?: boolean;
};

export class SharedInfrastructureStack extends Stack {
	vpcId: string;
	constructor(scope: Construct, id: string, props: SharedStackProperties) {
		super(scope, id, props);

		const s3 = new S3(this, 'S3', {
			deleteBucket: false,
		});

		new ssm.StringParameter(this, 'bucketNameParameter', {
			parameterName: bucketNameParameter,
			description: 'Shared Bucket Name for ARCADE',
			stringValue: s3.bucketName,
		});

		new ssm.StringParameter(this, 'bucketArnParameter', {
			parameterName: bucketArnParameter,
			description: 'Shared Bucket Arn for ARCADE',
			stringValue: s3.bucketArn,
		});

		new Cognito(this, 'Cognito', {
			environment: props.environment,
			administratorEmail: props.administratorEmail,
			userPoolEmail: props.userPoolEmail,
		});

		new Bus(this, 'EventBus');

	}
}

import { Bus, S3 } from '@arcade/cdk-common';
import { Stack, StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { Cognito } from './cognito.construct.js';

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

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		const bucketName = `arcade-${accountId}-${region}-shared`;
		new S3(this, 'S3', {
			environment: props.environment,
			bucketName,
			cdkResourceNamePrefix: 'Shared',
			deleteBucket: props.deleteBucket,
		});

		new Cognito(this, 'Cognito', {
			environment: props.environment,
			administratorEmail: props.administratorEmail,
			userPoolEmail: props.userPoolEmail,
		});

		const eventBusName = `arcade-${accountId}-${region}`;
		new Bus(this, 'EventBus', {
			environment: props.environment,
			eventBusName,
		});

	}
}

import { Bus, S3 } from '@arcade/cdk-common';
import { Stack, StackProps } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';
import { Cognito } from './cognito.construct.js';
import { Network } from './network.construct.js';

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
	vpc: IVpc;
	bucketName: string;
	eventBusName: string;
	eventBusArn: string;
	constructor(scope: Construct, id: string, props: SharedStackProperties) {
		super(scope, id, props);

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		const bucketName = `arcade-${accountId}-${region}-shared`;
		const s3 = new S3(this, 'S3', {
			environment: props.environment,
			bucketName,
			cdkResourceNamePrefix: 'Shared',
			deleteBucket: props.deleteBucket,
		});

		this.bucketName = s3.bucketName;

		new Cognito(this, 'Cognito', {
			environment: props.environment,
			administratorEmail: props.administratorEmail,
			userPoolEmail: props.userPoolEmail,
		});

		const eventBusName = `arcade-${accountId}-${region}`;
		const bus = new Bus(this, 'EventBus', {
			environment: props.environment,
			eventBusName,
		});

		const network = new Network(this, 'Network', {});
		this.vpc = network.vpc;
		this.eventBusName = eventBusName;
		this.eventBusArn = bus.eventBusArn;
	}
}

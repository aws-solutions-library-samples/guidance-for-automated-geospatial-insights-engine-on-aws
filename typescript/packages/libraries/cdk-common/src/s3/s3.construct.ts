import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export const bucketNameParameter = (environment: string) => `/arcade/${environment}/shared/bucketName`;
export const bucketArnParameter = (environment: string) => `/arcade/${environment}/shared/bucketArn`;

export interface S3ConstructProperties {
	environment: string;
	bucketName: string;
	cdkResourceNamePrefix: string;
	deleteBucket: boolean;
}
export class S3 extends Construct {
	public readonly bucketName: string;
	public readonly bucketArn: string;

	constructor(scope: Construct, id: string, props: S3ConstructProperties) {
		super(scope, id);

		const bucket = new s3.Bucket(this, `${props.cdkResourceNamePrefix}Bucket`, {
			bucketName: props.bucketName,
			encryption: s3.BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180),
				},
			],
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: props.deleteBucket,
			versioned: !props.deleteBucket,
			serverAccessLogsPrefix: 'access-logs',
			removalPolicy: props.deleteBucket ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
		});

		this.bucketArn = bucket.bucketArn;
		this.bucketName = bucket.bucketName;

		new StringParameter(this, `${props.cdkResourceNamePrefix}BucketNameParameter`, {
			parameterName: bucketNameParameter(props.environment),
			description: `${props.cdkResourceNamePrefix} ARCADE bucket (${props.environment})`,
			stringValue: this.bucketName,
		});

		new StringParameter(this, `${props.cdkResourceNamePrefix}BucketArnParameter`, {
			parameterName: bucketArnParameter(props.environment),
			description: `${props.cdkResourceNamePrefix} ARCADE bucket (${props.environment})`,
			stringValue: this.bucketArn,
		});
	}
}

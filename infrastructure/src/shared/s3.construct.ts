import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import {RemovalPolicy, Duration, Stack} from 'aws-cdk-lib';

export interface S3ConstructProperties {
	deleteBucket: boolean;
}

export const bucketNameParameter = `/arcade/shared/bucketName`;
export const bucketArnParameter = `/arcade/shared/bucketArn`;

export class S3 extends Construct {
	public readonly bucketName: string;
	public readonly bucketArn: string;

	constructor(scope: Construct, id: string, props: S3ConstructProperties) {
		super(scope, id);

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;
		const bucketName = `arcade-${accountId}-${region}`;


		const bucket = new s3.Bucket(this, 'ArcadeBucket', {
			bucketName: bucketName,
			encryption: s3.BucketEncryption.S3_MANAGED,
			intelligentTieringConfigurations: [
				{
					name: 'archive',
					archiveAccessTierTime: Duration.days(90),
					deepArchiveAccessTierTime: Duration.days(180)
				}
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
	}
}

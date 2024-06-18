import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { StringParameter } from "aws-cdk-lib/aws-ssm";

export const websiteBucketParameter = (environment: string) => `/arcade/${environment}/ui/websiteBucket`;

export interface StaticSiteConstructProperties {
	environment: string;
}

export class StaticSite extends Construct {
	readonly distribution: cloudfront.CloudFrontWebDistribution;

	constructor(scope: Construct, id: string, props: StaticSiteConstructProperties) {
		super(scope, id);

		const hostingBucket = new s3.Bucket(this, 'StaticSiteBucket', {
			versioned: true,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			encryption: s3.BucketEncryption.S3_MANAGED,
			enforceSSL: true,
		});

		const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
		hostingBucket.grantRead(originAccessIdentity);

		const distribution = new cloudfront.CloudFrontWebDistribution(this, 'WebsiteDistribution', {
			originConfigs: [
				{
					s3OriginSource: {
						s3BucketSource: hostingBucket,
						originAccessIdentity: originAccessIdentity,
					},
					behaviors: [
						{
							isDefaultBehavior: true,
							viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
						},
					],
				},
			],
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			errorConfigurations: [
				{
					errorCode: 404,
					errorCachingMinTtl: 0,
					responseCode: 200,
					responsePagePath: '/index.html',
				},
				{
					errorCode: 403,
					errorCachingMinTtl: 0,
					responseCode: 200,
					responsePagePath: '/index.html',
				},
			],
		});

		new StringParameter(this, 'WebsiteBucketParameter', {
			parameterName: websiteBucketParameter(props.environment),
			stringValue: hostingBucket.bucketName,
		});

		this.distribution = distribution;

		new cdk.CfnOutput(this, 'WebsiteDomain', {
			value: distribution.distributionDomainName,
			description: 'Domain for the CloudFront distribution',
		});
		NagSuppressions.addResourceSuppressions(
			[hostingBucket],
			[
				{
					id: 'AwsSolutions-S1',
					reason: 'No access logs for hosting bucket.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[distribution],
			[
				{
					id: 'AwsSolutions-CFR3',
					reason: 'No access logs on distribution for now.',
				},
				{
					id: 'AwsSolutions-CFR4',
					reason: 'No TLSV1.1 or 1.2 on distribution for now.',
				},
			],
			true
		);
	}
}

import { eventBusNameParameter } from '@arcade/cdk-common';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';
import { ResultsConstruct } from './results.construct.js';

export type ResultsStackProperties = StackProps & {
	moduleName: string;
	environment: string;
	bucketName: string;
	regionsApiFunctionArn: string;
	stacServerTopicArn: string;
	stacServerFunctionName: string;
};

export const resultsTableNameParameter = (environment: string) => `/arcade/${environment}/results/tableName`;
export const resultsTableArnParameter = (environment: string) => `/arcade/${environment}/results/tableArn`;

export class ResultsStack extends Stack {
	constructor(scope: Construct, id: string, props: ResultsStackProperties) {
		super(scope, id, props);

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const results = new ResultsConstruct(this, 'Results', {
			moduleName: props.moduleName,
			environment: props.environment,
			bucketName: props.bucketName,
			stacServerTopicArn: props.stacServerTopicArn,
			stacServerFunctionName: props.stacServerFunctionName,
			eventBusName,
			regionsApiFunctionArn: props.regionsApiFunctionArn,
		});

		new ssm.StringParameter(this, 'tableNameParameter', {
			parameterName: resultsTableNameParameter(props.environment),
			description: 'results table Name for ARCADE',
			stringValue: results.tableName,
		});

		new ssm.StringParameter(this, 'tableArnParameter', {
			parameterName: resultsTableArnParameter(props.environment),
			description: 'shared Event Bus Arn for ARCADE',
			stringValue: results.tableArn,
		});

		NagSuppressions.addResourceSuppressionsByPath(
			this,
			'/ResultsStack/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
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
	}
}

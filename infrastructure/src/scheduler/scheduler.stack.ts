/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { bucketNameParameter, eventBusNameParameter } from '@agie/cdk-common';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import {
	engineProcessorHighPriorityQueueArn,
	engineProcessorJobDefinitionArnParameter,
	engineProcessorLowPriorityQueueArn,
	engineProcessorStandardPriorityQueueArn,
} from '../engine/engine.construct.js';
import { regionsApiFunctionArnParameter } from '../regions/regions.construct.js';
import { resultsApiFunctionArnParameter } from '../results/results.construct.js';
import { ExecutorModule } from './executor.construct.js';
import { SchedulerModule } from './scheduler.construct.js';

export type SchedulerStackProperties = StackProps & {
	readonly environment: string;
	readonly concurrencyLimit: number;
	readonly sentinelTopicArn: string;
	readonly stacApiEndpoint: string;
	readonly stacApiResourceArn: string;
	readonly sentinelApiUrl: string;
	readonly sentinelCollection: string;
};

export class SchedulerStack extends Stack {
	constructor(scope: Construct, id: string, props: SchedulerStackProperties) {
		super(scope, id, props);

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const regionsApiFunctionArn = StringParameter.fromStringParameterAttributes(this, 'regionsApiFunctionArn', {
			parameterName: regionsApiFunctionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const resultsApiFunctionArn = StringParameter.fromStringParameterAttributes(this, 'resultsApiFunctionArn', {
			parameterName: resultsApiFunctionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const jobDefinitionArn = StringParameter.fromStringParameterAttributes(this, 'jobDefinitionArn', {
			parameterName: engineProcessorJobDefinitionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const highPriorityQueueArn = StringParameter.fromStringParameterAttributes(this, 'highPriorityQueueArn', {
			parameterName: engineProcessorHighPriorityQueueArn(props.environment),
			simpleName: false,
		}).stringValue;

		const standardPriorityQueueArn = StringParameter.fromStringParameterAttributes(this, 'standardPriorityQueueArn', {
			parameterName: engineProcessorStandardPriorityQueueArn(props.environment),
			simpleName: false,
		}).stringValue;

		const lowPriorityQueueArn = StringParameter.fromStringParameterAttributes(this, 'lowPriorityQueueArn', {
			parameterName: engineProcessorLowPriorityQueueArn(props.environment),
			simpleName: false,
		}).stringValue;

		const bucketName = StringParameter.fromStringParameterAttributes(this, 'bucketName', {
			parameterName: bucketNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const regionsApiLambda = Function.fromFunctionAttributes(this, 'RegionsApiFunction', { functionArn: regionsApiFunctionArn, sameEnvironment: true });

		const resultsApiLambda = Function.fromFunctionAttributes(this, 'ResultsApiFunction', {
			functionArn: resultsApiFunctionArn,
			sameEnvironment: true,
		});

		const schedulerModule = new SchedulerModule(this, 'SchedulerModule', {
			environment: props.environment,
			sentinelTopicArn: props.sentinelTopicArn,
			eventBusName,
			bucketName,
			regionsApiLambda,
			resultsApiLambda,
			stacApiEndpoint: props.stacApiEndpoint,
			stacApiResourceArn: props.stacApiResourceArn,
			sentinelCollection: props.sentinelCollection,
			sentinelApiUrl: props.sentinelApiUrl,
		});

		const executorModule = new ExecutorModule(this, 'ExecutorModule', {
			environment: props.environment,
			concurrencyLimit: props.concurrencyLimit,
			jobDefinitionArn,
			eventBusName,
			lowPriorityQueueArn,
			highPriorityQueueArn,
			standardPriorityQueueArn,
			regionsApiLambda,
			bucketName,
			engineQueue: schedulerModule.engineQueue,
		});

		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/SchedulerModule/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource'],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy attached to the role is generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*'],
					reason: 'This resource condition in the IAM policy is generated by CDK, this only applies to logs:DeleteRetentionPolicy and logs:PutRetentionPolicy actions.',
				},
			],
			true
		);
	}
}

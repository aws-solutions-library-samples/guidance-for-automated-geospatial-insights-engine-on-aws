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
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import {
	engineApiFunctionArnParameter,
	engineProcessorDefaultResourceEngineIdParameter,
	engineProcessorHighPriorityQueueArn,
	engineProcessorJobDefinitionArnParameter,
	engineProcessorLowPriorityQueueArn,
	engineProcessorStandardPriorityQueueArn,
} from '../engine/engine.construct.js';
import { regionsApiFunctionArnParameter } from '../regions/regions.construct.js';
import { userPoolClientIdParameter, userPoolIdParameter } from '../shared/cognito.construct.js';
import { verifiedPermissionsPolicyStoreIdParameter } from '../shared/verifiedPermissions.construct.js';
import { ExecutorModule } from './executor.construct.js';

export type ExecutorStackProperties = StackProps & {
	readonly environment: string;
	readonly concurrencyLimit: number;
	readonly engineQueue: IQueue;
};

export class ExecutorStack extends Stack {
	constructor(scope: Construct, id: string, props: ExecutorStackProperties) {
		super(scope, id, props);

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const regionsApiFunctionArn = StringParameter.fromStringParameterAttributes(this, 'regionsApiFunctionArn', {
			parameterName: regionsApiFunctionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const jobDefinitionArn = StringParameter.fromStringParameterAttributes(this, 'jobDefinitionArn', {
			parameterName: engineProcessorJobDefinitionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const defaultEngineResourceId = StringParameter.fromStringParameterAttributes(this, 'DefaultEngineResourceId', {
			parameterName: engineProcessorDefaultResourceEngineIdParameter(props.environment),
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

		const policyStoreId = StringParameter.fromStringParameterAttributes(this, 'policyStoreId', {
			parameterName: verifiedPermissionsPolicyStoreIdParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const cognitoClientId = StringParameter.fromStringParameterAttributes(this, 'clientId', {
			parameterName: userPoolClientIdParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const cognitoUserPoolId = StringParameter.fromStringParameterAttributes(this, 'userPoolId', {
			parameterName: userPoolIdParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const regionsApiLambda = Function.fromFunctionAttributes(this, 'RegionsApiFunction', { functionArn: regionsApiFunctionArn, sameEnvironment: true });

		const engineApiFunctionArn = StringParameter.fromStringParameterAttributes(this, 'engineApiFunctionArn', {
			parameterName: engineApiFunctionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const engineApiLambda = Function.fromFunctionAttributes(this, 'EngineApiFunction', { functionArn: engineApiFunctionArn, sameEnvironment: true });

		new ExecutorModule(this, 'ExecutorModule', {
			environment: props.environment,
			concurrencyLimit: props.concurrencyLimit,
			jobDefinitionArn,
			eventBusName,
			lowPriorityQueueArn,
			highPriorityQueueArn,
			standardPriorityQueueArn,
			regionsApiLambda,
			bucketName,
			engineQueue: props.engineQueue,
			cognitoClientId,
			cognitoUserPoolId,
			policyStoreId,
			engineApiLambda,
			defaultEngineResourceId,
		});

		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/ExecutorModule/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource'],
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

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

import { eventBusNameParameter } from '@arcade/cdk-common';
import { Stack, StackProps } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';
import { userPoolClientIdParameter, userPoolIdParameter } from '../shared/cognito.construct.js';
import { verifiedPermissionsPolicyStoreIdParameter } from '../shared/verifiedPermissions.construct.js';
import { RegionsModule } from './regions.construct.js';
import { IVpc } from "aws-cdk-lib/aws-ec2";

export type RegionsStackProperties = StackProps & {
	environment: string;
	policyStoreIdParameter: string;
	vpc: IVpc;
};

export class RegionsApiStack extends Stack {
	public readonly regionsFunctionName: string;
	public readonly regionsFunctionArn: string;

	constructor(scope: Construct, id: string, props: RegionsStackProperties) {
		super(scope, id, props);

		// validation
		this.validateMandatoryParam(props, 'environment');

		const cognitoUserPoolId = StringParameter.fromStringParameterAttributes(this, 'userPoolId', {
			parameterName: userPoolIdParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const cognitoClientId = StringParameter.fromStringParameterAttributes(this, 'clientId', {
			parameterName: userPoolClientIdParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const policyStoreId = StringParameter.fromStringParameterAttributes(this, 'policyStoreId', {
			parameterName: verifiedPermissionsPolicyStoreIdParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const regionsModule = new RegionsModule(this, 'RegionsModule', {
			environment: props.environment,
			cognitoUserPoolId,
			cognitoClientId,
			eventBusName,
			policyStoreId,
			vpc: props.vpc
		});

		this.regionsFunctionName = regionsModule.regionsFunctionName;
		this.regionsFunctionArn = regionsModule.regionsFunctionArn;

		NagSuppressions.addResourceSuppressionsByPath(
			this,
			['/RegionsModule/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource'],
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

	private validateMandatoryParam(props: RegionsStackProperties, name: string) {
		if (props[name] === undefined) {
			throw new Error(`${name} is required`);
		}
	}
}
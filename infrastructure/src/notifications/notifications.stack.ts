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

import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { bucketNameParameter, eventBusNameParameter } from "@arcade/cdk-common";
import { NotificationsModule } from "./notifications.construct.js";
import { userPoolClientIdParameter, userPoolIdParameter } from "../shared/cognito.construct.js";
import { NagSuppressions } from "cdk-nag";
import { verifiedPermissionsPolicyStoreIdParameter } from "../shared/verifiedPermissions.construct.js";
import { regionsApiFunctionArnParameter } from "../regions/regions.construct.js";

export type NotificationsStackProperties = StackProps & {
	environment: string;
}

export class NotificationsStack extends Stack {
	constructor(scope: Construct, id: string, props: NotificationsStackProperties) {
		super(scope, id, props);

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const regionsApiFunctionArn = StringParameter.fromStringParameterAttributes(this, 'regionsApiFunctionArn', {
			parameterName: regionsApiFunctionArnParameter(props.environment),
			simpleName: false,
		}).stringValue;


		const cognitoUserPoolId = StringParameter.fromStringParameterAttributes(this, 'userPoolId', {
			parameterName: userPoolIdParameter(props.environment),
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

		new NotificationsModule(this, 'NotificationsModule', {
			environment: props.environment,
			eventBusName,
			bucketName,
			cognitoUserPoolId,
			policyStoreId,
			cognitoClientId,
			regionsApiFunctionArn
		})

		NagSuppressions.addResourceSuppressionsByPath(
			this,
			[
				'/NotificationsModule/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
			],
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
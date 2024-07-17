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

import { bucketNameParameter, eventBusNameParameter } from "@arcade/cdk-common";
import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from 'constructs';
import { EngineConstruct } from "./engine.construct.js";

export type EngineStackProperties = StackProps & {
	readonly environment: string;
	readonly vpc: IVpc;
	readonly stacApiEndpoint: string;
	readonly stacApiResourceArn: string;
	readonly sentinelApiUrl: string;
	readonly sentinelCollection: string;
}

export class EngineStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: EngineStackProperties) {
		super(scope, id, props);

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		const bucketName = StringParameter.fromStringParameterAttributes(this, 'bucketName', {
			parameterName: bucketNameParameter(props.environment),
			simpleName: false,
		}).stringValue;

		new EngineConstruct(this, "EngineModule",
			{
				vpc: props.vpc,
				environment: props.environment,
				eventBusName,
				bucketName,
				stacApiEndpoint: props.stacApiEndpoint,
				stacApiResourceArn: props.stacApiResourceArn,
				sentinelApiUrl: props.sentinelApiUrl,
				sentinelCollection: props.sentinelCollection
			})
	}
}

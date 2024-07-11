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

import { EventBus } from 'aws-cdk-lib/aws-events';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export const eventBusNameParameter = (environment: string) => `/arcade/${environment}/shared/eventBusName`;
export const eventBusArnParameter = (environment: string) => `/arcade/${environment}/shared/eventBusArn`;

export interface BusConstructProperties {
	environment: string;
	eventBusName: string;
}
export class Bus extends Construct {
	public readonly eventBusName: string;
	public readonly eventBusArn: string;
	public readonly eventBus: EventBus;

	constructor(scope: Construct, id: string, props: BusConstructProperties) {
		super(scope, id);

		const bus = new EventBus(this, 'EventBus', {
			eventBusName: props.eventBusName,
		});

		this.eventBus = bus;
		this.eventBusName = bus.eventBusName;
		this.eventBusArn = bus.eventBusArn;

		new StringParameter(this, `EventBusNameParameter`, {
			parameterName: eventBusNameParameter(props.environment),
			description: `ARCADE event bus name (${props.environment})`,
			stringValue: this.eventBusName,
		});

		new StringParameter(this, `EventBusArnParameter`, {
			parameterName: eventBusArnParameter(props.environment),
			description: `ARCADE event bus arn (${props.environment})`,
			stringValue: this.eventBusArn,
		});
	}
}

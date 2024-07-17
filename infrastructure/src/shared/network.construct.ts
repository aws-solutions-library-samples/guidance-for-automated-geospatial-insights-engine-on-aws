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

import { Construct } from 'constructs';
import { IVpc, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { NagSuppressions } from 'cdk-nag';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface NetworkConstructProperties {
}

export class Network extends Construct {

	public vpc: IVpc;

	constructor(scope: Construct, id: string, props: NetworkConstructProperties) {
		super(scope, id);

		this.vpc = new Vpc(this, 'Vpc', {
			subnetConfiguration: [
				{
					name: 'public-subnet',
					subnetType: SubnetType.PUBLIC,
					cidrMask: 24
				},
				{
					name: 'private-subnet',
					subnetType: SubnetType.PRIVATE_WITH_EGRESS,
					cidrMask: 24
				},
				{
					name: 'isolated-subnet',
					subnetType: SubnetType.PRIVATE_ISOLATED,
					cidrMask: 24
				}
			]
		});

		this.vpc.addInterfaceEndpoint('kmsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.KMS,
			subnets: {
				subnetGroupName: 'private-subnet'
			}
		});

		this.vpc.addInterfaceEndpoint('eventBridgeEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE,
			subnets: {
				subnetGroupName: 'private-subnet'
			}
		});

		this.vpc.addInterfaceEndpoint('sqsEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.SQS,
			subnets: {
				subnetGroupName: 'private-subnet'
			}
		});

		this.vpc.addInterfaceEndpoint('xrayEndpoint', {
			service: ec2.InterfaceVpcEndpointAwsService.XRAY,
			subnets: {
				subnetGroupName: 'private-subnet'
			}
		});

		NagSuppressions.addResourceSuppressions(this.vpc, [
			{
				id: 'AwsSolutions-VPC7',
				reason: 'Ignore for now.'
			}
		], true);
	}


}

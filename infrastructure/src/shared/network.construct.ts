import { Construct } from "constructs";
import { IVpc, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { NagSuppressions } from "cdk-nag";

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
					cidrMask: 24,
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

		NagSuppressions.addResourceSuppressions(this.vpc, [
			{
				id: 'AwsSolutions-VPC7',
				reason: 'Ignore for now.',
			}
		], true);
	}


}

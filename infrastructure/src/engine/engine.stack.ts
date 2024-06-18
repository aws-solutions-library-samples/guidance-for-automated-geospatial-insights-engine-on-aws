import { bucketNameParameter, eventBusNameParameter } from "@arcade/cdk-common";
import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from 'constructs';
import { EngineConstruct } from "./engine.construct.js";

export type EngineStackProperties = StackProps & {
	environment: string;
	vpc: IVpc;
	stacApiEndpoint: string;
	stacApiResourceArn: string;
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
				stacApiResourceArn: props.stacApiResourceArn
			})
	}
}

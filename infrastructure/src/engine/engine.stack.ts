import { bucketNameParameter, eventBusNameParameter } from "@arcade/cdk-common";
import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from 'constructs';
import { EngineConstruct } from "./engine.construct.js";
import { stacApiSecretNameParameter } from "../shared/shared.stack.js";

export type EngineStackProperties = StackProps & {
	environment: string;
	vpc: IVpc;
	stacServerUrl: string;
}

export class EngineStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: EngineStackProperties) {
		super(scope, id, props);

		const eventBusName = StringParameter.fromStringParameterAttributes(this, 'eventBusName', {
			parameterName: eventBusNameParameter(props.environment),
			simpleName: false,
		}).stringValue;


		const stacApiSecretName = StringParameter.fromStringParameterAttributes(this, 'stacApiSecretName', {
			parameterName: stacApiSecretNameParameter(props.environment),
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
				stacApiSecretName,
				stacServerUrl: props.stacServerUrl
			})
	}
}

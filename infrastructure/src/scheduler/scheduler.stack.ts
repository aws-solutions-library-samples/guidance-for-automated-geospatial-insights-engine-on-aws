import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { bucketNameParameter, eventBusNameParameter } from "@arcade/cdk-common";
import { SchedulerModule } from "./scheduler.construct.js";
import { NagSuppressions } from "cdk-nag";
import {
    engineProcessorJobDefinitionArnParameter,
    engineProcessorJobQueueArnParameter
} from "../engine/engine.construct.js";
import { regionsApiFunctionArnParameter } from "../regions/regions.construct.js";
import { ExecutorModule } from "./executor.construct.js";

export type SchedulerStackProperties = StackProps & {
    environment: string;
    concurrencyLimit: number;
}

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


        const jobDefinitionArn = StringParameter.fromStringParameterAttributes(this, 'jobDefinitionArn', {
            parameterName: engineProcessorJobDefinitionArnParameter(props.environment),
            simpleName: false,
        }).stringValue;

        const jobQueueArn = StringParameter.fromStringParameterAttributes(this, 'jobQueueArn', {
            parameterName: engineProcessorJobQueueArnParameter(props.environment),
            simpleName: false,
        }).stringValue;

        const bucketName = StringParameter.fromStringParameterAttributes(this, 'bucketName', {
            parameterName: bucketNameParameter(props.environment),
            simpleName: false,
        }).stringValue;

        const schedulerModule = new SchedulerModule(this, 'SchedulerModule', {
            environment: props.environment,
            eventBusName,
            bucketName
        })

        const executorModule = new ExecutorModule(this, 'ExecutorModule', {
            environment: props.environment,
            concurrencyLimit: props.concurrencyLimit,
            eventBusName,
            jobDefinitionArn,
            jobQueueArn,
            regionsApiFunctionArn,
            bucketName,
            engineQueue: schedulerModule.engineQueue
        })

        NagSuppressions.addResourceSuppressionsByPath(
            this,
            [
                '/SchedulerModule/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
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
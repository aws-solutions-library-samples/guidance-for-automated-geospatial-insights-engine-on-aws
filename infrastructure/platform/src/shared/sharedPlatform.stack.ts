import { Stack, StackProps } from 'aws-cdk-lib';
import { Bus, S3, bucketArnParameter, bucketNameParameter, eventBusNameParameter, eventBusArnParameter } from '@arcade/cdk-common';
import type { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';


export type SharedPlatformStackProperties = StackProps & {
    deleteBucket?: boolean;
};


export class SharedPlatformInfrastructureStack extends Stack {
    vpcId: string;
    constructor(scope: Construct, id: string, props: SharedPlatformStackProperties) {
        super(scope, id, props);

        const s3 = new S3(this, 'S3', {
            deleteBucket: false
        });

        new ssm.StringParameter(this, 'bucketNameParameter', {
            parameterName: bucketNameParameter,
            description: 'shared Bucket Name for ARCADE',
            stringValue: s3.bucketName
        });

        new ssm.StringParameter(this, 'bucketArnParameter', {
            parameterName: bucketArnParameter,
            description: 'shared Bucket Arn for ARCADE',
            stringValue: s3.bucketArn
        });

        const bus = new Bus(this, 'EventBus');

        new ssm.StringParameter(this, 'eventBusNameParameter', {
            parameterName: eventBusNameParameter,
            description: 'shared Event Bus Name for ARCADE',
            stringValue: bus.eventBusName
        });

        new ssm.StringParameter(this, 'eventBusArnParameter', {
            parameterName: eventBusArnParameter,
            description: 'shared Event Bus Arn for ARCADE',
            stringValue: bus.eventBusArn
        });

    }
}

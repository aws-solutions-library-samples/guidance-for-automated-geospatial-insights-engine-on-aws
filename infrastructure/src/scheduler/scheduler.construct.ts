import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path from "path";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Duration } from "aws-cdk-lib";
import { getLambdaArchitecture } from "@arcade/cdk-common";
import { fileURLToPath } from "url";
import { NagSuppressions } from "cdk-nag";
import { EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";
import { AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { CfnScheduleGroup } from "aws-cdk-lib/aws-scheduler";
import { REGIONS_EVENT_SOURCE, RESULTS_ZONE_CREATED_EVENT, RESULTS_ZONE_UPDATED_EVENT } from "@arcade/events";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScheduledConstructProperties {
	environment: string;
	eventBusName: string;
	jobDefinitionArn: string;
	jobQueueArn: string;
}

export class SchedulerModule extends Construct {
	constructor(scope: Construct, id: string, props: ScheduledConstructProperties) {
		super(scope, id);

		const namePrefix = `arcade-${props.environment}`;

		const engineProcessorJobDefinition = EcsJobDefinition.fromJobDefinitionArn(scope, 'EngineProcessJobDefinition', props.jobDefinitionArn)

		const jobQueue = JobQueue.fromJobQueueArn(scope, 'EngineProcessorJobQueueArn', props.jobQueueArn)

		const eventBus = EventBus.fromEventBusName(scope, 'EventBus', props.eventBusName)

		const engineDlq = new Queue(this, `taskDlq`, { queueName: `${namePrefix}-engine-dlq` });
		engineDlq.addToResourcePolicy(new PolicyStatement({
			sid: 'enforce-ssl',
			effect: Effect.DENY,
			principals: [new AnyPrincipal()],
			actions: ['sqs:*'],
			resources: [engineDlq.queueArn],
			conditions: {
				'Bool': {
					'aws:SecureTransport': 'false'
				}
			}
		}));

		const engineQueue = new Queue(this, `taskQueue`, {
			queueName: `${namePrefix}-engine-queue`,
			deadLetterQueue: {
				maxReceiveCount: 10,
				queue: engineDlq
			},
			visibilityTimeout: Duration.minutes(15)
		});

		engineQueue.addToResourcePolicy(new PolicyStatement({
			sid: 'enforce-ssl',
			effect: Effect.DENY,
			principals: [new AnyPrincipal()],
			actions: ['sqs:*'],
			resources: [engineQueue.queueArn],
			conditions: {
				'Bool': {
					'aws:SecureTransport': 'false'
				}
			}
		}));

		const cfnScheduleGroup = new CfnScheduleGroup(this, 'ArcadeScheduleGroup', {
			name: `${namePrefix}-arcade`,
		});

		const arcadeSchedulerRole = new Role(this, 'ArcadeSchedulerRole', {
			assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
		});

		// This role will be used by scheduled to push message to SQS
		arcadeSchedulerRole.addToPolicy(new PolicyStatement({
			actions: ['sqs:SendMessage'],
			effect: Effect.ALLOW,
			resources: [engineQueue.queueArn],
		}))

		// Lambda function that processor schedule queued in SQS
		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			description: 'Scheduler module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/scheduler/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-scheduler-eventbridge-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				SCHEDULER_GROUP: cfnScheduleGroup.name,
				SQS_ARN: engineQueue.queueArn,
				ROLE_ARN: arcadeSchedulerRole.roleArn
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.1',
				sourceMap: false,
				sourcesContent: false,
				banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
				externalModules: ['aws-sdk', 'pg-native']
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope)
		});

		// Allow eventbridge lambda role to pass scheduler rule when creating schedule
		arcadeSchedulerRole.grantPassRole(eventbridgeLambda.role);
		eventBus.grantPutEventsTo(eventbridgeLambda);
		// Allow eventbridge lambda to create scheduler rule
		eventbridgeLambda.addToRolePolicy(new PolicyStatement({
			actions: [
				"scheduler:CreateSchedule",
				"scheduler:UpdateSchedule",
				"scheduler:GetSchedule",
			],
			effect: Effect.ALLOW,
			resources: ['*'],
		}))

		eventbridgeLambda.addToRolePolicy(new PolicyStatement({
			actions: [
				"scheduler:ListScheduleGroups",
				"scheduler:GetScheduleGroup",
			],
			effect: Effect.ALLOW,
			resources: [cfnScheduleGroup.attrArn],
		}))

		const zoneRuleDlq = new Queue(this, 'ZoneRuleDq');

		zoneRuleDlq.addToResourcePolicy(new PolicyStatement({
			sid: 'enforce-ssl',
			effect: Effect.DENY,
			principals: [new AnyPrincipal()],
			actions: ['sqs:*'],
			resources: [zoneRuleDlq.queueArn],
			conditions: {
				'Bool': {
					'aws:SecureTransport': 'false'
				}
			}
		}));

		const zoneCreatedRule = new Rule(this, 'ZoneCreatedRule', {
			eventBus: eventBus,
			eventPattern: {
				detailType: [
					RESULTS_ZONE_CREATED_EVENT,
					RESULTS_ZONE_UPDATED_EVENT
				],
				source: [REGIONS_EVENT_SOURCE]
			}
		});

		zoneCreatedRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: zoneRuleDlq,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2
			})
		);

		// Lambda function that processor schedule queued in SQS
		const sqsProcessorLambda = new NodejsFunction(this, 'SqsProcessorLambda', {
			description: 'Scheduler module sqs processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/scheduler/src/lambda_sqs.ts'),
			functionName: `${namePrefix}-scheduler-sqs-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				JOB_DEFINITION_ARN: engineProcessorJobDefinition.jobDefinitionArn,
				JOB_QUEUE_ARN: jobQueue.jobQueueArn
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.1',
				sourceMap: false,
				sourcesContent: false,
				banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);import { fileURLToPath } from \'url\';import { dirname } from \'path\';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);',
				externalModules: ['aws-sdk', 'pg-native']
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope)
		});

		sqsProcessorLambda.addEventSource(
			new SqsEventSource(engineQueue, {
				batchSize: 10,
				reportBatchItemFailures: true
			})
		);

		sqsProcessorLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: [
					"batch:SubmitJob",
					"batch:DescribeJobs",
					"batch:TerminateJob"
				],
				resources: [
					engineProcessorJobDefinition.jobDefinitionArn,
					jobQueue.jobQueueArn],
			})
		)

		NagSuppressions.addResourceSuppressions(
			[sqsProcessorLambda, eventbridgeLambda],
			[
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
					reason: 'This policy is the one generated by CDK.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::*'],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.',
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions([engineDlq, zoneRuleDlq],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.'

				}
			],
			true);


	}

}

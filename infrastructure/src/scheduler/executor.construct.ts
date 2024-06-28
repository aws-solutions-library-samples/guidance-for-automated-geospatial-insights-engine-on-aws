import { Construct } from "constructs";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import path from "path";
import { IFunction, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Duration } from "aws-cdk-lib";
import { getLambdaArchitecture } from "@arcade/cdk-common";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { AnyPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { IQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { NagSuppressions } from "cdk-nag";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { fileURLToPath } from "url";

export interface ExecutorConstructProperties {
	environment: string
	eventBusName: string;
	bucketName: string;
	jobDefinitionArn: string;
	regionsApiLambda: IFunction;
	resultsApiLambda: IFunction;
	highPriorityQueueArn: string;
	standardPriorityQueueArn: string;
	lowPriorityQueueArn: string;
	concurrencyLimit: number;
	engineQueue: IQueue;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ExecutorModule extends Construct {

	constructor(scope: Construct, id: string, props: ExecutorConstructProperties) {
		super(scope, id);

		const namePrefix = `arcade-${props.environment}`;

		const engineProcessorJobDefinition = EcsJobDefinition.fromJobDefinitionArn(scope, 'EngineProcessJobDefinition', props.jobDefinitionArn);

		const highPriorityQueue = JobQueue.fromJobQueueArn(scope, 'HighPriorityQueue', props.highPriorityQueueArn);
		const standardPriorityQueue = JobQueue.fromJobQueueArn(scope, 'StandardPriorityQueue', props.standardPriorityQueueArn);
		const lowPriorityQueue = JobQueue.fromJobQueueArn(scope, 'LowPriorityQueue', props.lowPriorityQueueArn);

		const bucket = Bucket.fromBucketName(scope, 'Bucket', props.bucketName);

		const eventBus = EventBus.fromEventBusName(scope, 'Bus', props.eventBusName)


		// Lambda function that processor schedule queued in SQS
		const sqsProcessorLambda = new NodejsFunction(this, 'SqsProcessorLambda', {
			description: 'Executor module sqs processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/executor/src/lambda_sqs.ts'),
			functionName: `${namePrefix}-executor-sqs-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(5),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				JOB_DEFINITION_ARN: engineProcessorJobDefinition.jobDefinitionArn,
				HIGH_PRIORITY_QUEUE_ARN: highPriorityQueue.jobQueueArn,
				LOW_PRIORITY_QUEUE_ARN: lowPriorityQueue.jobQueueArn,
				STANDARD_PRIORITY_QUEUE_ARN: standardPriorityQueue.jobQueueArn,
				CONCURRENCY_LIMIT: props.concurrencyLimit.toString(),
				REGIONS_API_FUNCTION_NAME: props.regionsApiLambda.functionName,
				RESULTS_API_FUNCTION_NAME: props.resultsApiLambda.functionName,
				BUCKET_NAME: props.bucketName
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.1',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk', 'pg-native'],
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		props.regionsApiLambda.grantInvoke(sqsProcessorLambda);
		props.resultsApiLambda.grantInvoke(sqsProcessorLambda);
		bucket.grantReadWrite(sqsProcessorLambda);
		eventBus.grantPutEventsTo(sqsProcessorLambda);

		sqsProcessorLambda.addEventSource(
			new SqsEventSource(props.engineQueue, {
				batchSize: 10,
				reportBatchItemFailures: true,
			})
		);

		sqsProcessorLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['batch:SubmitJob', 'batch:DescribeJobs', 'batch:TerminateJob', 'batch:TagResource'],
				resources: [engineProcessorJobDefinition.jobDefinitionArn, highPriorityQueue.jobQueueArn, lowPriorityQueue.jobQueueArn, standardPriorityQueue.jobQueueArn],
			})
		);

		const awsBatchStateChangeRule = new Rule(this, "AwsBatchStateChangeRule", {
			eventPattern: {
				detailType: ["Batch Job State Change"],
				source: ["aws.batch"],
				"detail": {
					"jobDefinition": [engineProcessorJobDefinition.jobDefinitionArn]
				}
			},
		})

		// Lambda function that processor schedule queued in SQS
		const eventbridgeLambda = new NodejsFunction(this, 'EventBridgeProcessorLambda', {
			description: 'Executor module eventbridge processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/executor/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-executor-eventbridge-processor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 512,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(1),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
			},
			bundling: {
				minify: true,
				format: OutputFormat.ESM,
				target: 'node20.1',
				sourceMap: false,
				sourcesContent: false,
				banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);import { fileURLToPath } from 'url';import { dirname } from 'path';const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
				externalModules: ['aws-sdk', 'pg-native'],
			},
			depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
			architecture: getLambdaArchitecture(scope),
		});

		eventBus.grantPutEventsTo(eventbridgeLambda);

		eventbridgeLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['batch:ListTagsForResource'],
				resources: ['*'],
			})
		);

		const executorEventBridgeHandlerDLQ = new Queue(this, 'ExecutorEventBridgeHandlerDLQ');

		executorEventBridgeHandlerDLQ.addToResourcePolicy(
			new PolicyStatement({
				sid: 'enforce-ssl',
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['sqs:*'],
				resources: [executorEventBridgeHandlerDLQ.queueArn],
				conditions: {
					Bool: {
						'aws:SecureTransport': 'false',
					},
				},
			})
		);

		awsBatchStateChangeRule.addTarget(
			new LambdaFunction(eventbridgeLambda, {
				deadLetterQueue: executorEventBridgeHandlerDLQ,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2,
			})
		);

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
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Resource::<regionsApiFunctionArnParameter>:*', 'Resource::<resultsApiFunctionArnParameter>:*'],
					reason: 'SQS processor lambda needs to invoke the regions api to retrieve list of polygons by region.',
				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: ['Action::s3:Abort*', 'Action::s3:DeleteObject*', 'Action::s3:GetBucket*', 'Action::s3:GetObject*', 'Action::s3:List*', 'Resource::arn:<AWS::Partition>:s3:::<bucketNameParameter>/*'],
					reason: 'the policy is required for the lambda to access the s3 bucket that contains reference datasets file.'
				},
			],
			true
		);

		NagSuppressions.addResourceSuppressions(
			[executorEventBridgeHandlerDLQ],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.',
				},
			],
			true
		);

	}
}

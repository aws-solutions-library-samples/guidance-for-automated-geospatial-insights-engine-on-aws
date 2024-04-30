import { Construct } from 'constructs';
import { RemovalPolicy, Duration, Stack } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { getLambdaArchitecture } from '@arcade/cdk-common';
import { RESULTS_COLLECTION_CREATE_EVENT, RESULTS_COMPLETED_EVENT, RESULTS_FAILED_EVENT, RESULTS_QUEUED_EVENT, RESULTS_STARTED_EVENT } from '@arcade/events';
import path from 'path';
import { fileURLToPath } from 'url';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResultsConstructProperties {
	readonly moduleName: string;
	readonly environment: string;
	readonly bucketName: string;
	readonly stacServerTopicArn: string;
	readonly stacServerFunctionName: string;
	readonly eventBusName: string;
	readonly regionsFunctionName: string;
}

export class ResultsConstruct extends Construct {
	public readonly tableName: string;
	public readonly tableArn: string;


	constructor(scope: Construct, id: string, props: ResultsConstructProperties) {
		super(scope, id);

		const accountId = Stack.of(this).account;
		const region = Stack.of(this).region;

		const namePrefix = `arcade-${props.environment}`;
		const eventBus = EventBus.fromEventBusName(this, 'EventBus', props.eventBusName);
		const bucket = Bucket.fromBucketName(this, 'Bucket', props.bucketName);
		const topic = Topic.fromTopicArn(this, 'StacServerArn', props.stacServerTopicArn);
		const regionsLambda = NodejsFunction.fromFunctionName(this, 'RegionLambda', props.regionsFunctionName);



		// DynamoDb Table

		const table = new Table(this, 'Table', {
			tableName: `${namePrefix}-${props.moduleName}`,
			partitionKey: {
				name: 'pk',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'sk',
				type: AttributeType.STRING,
			},
			billingMode: BillingMode.PAY_PER_REQUEST,
			encryption: TableEncryption.AWS_MANAGED,
			pointInTimeRecovery: true,
			removalPolicy: RemovalPolicy.DESTROY
		});

		// define GSI1
		table.addGlobalSecondaryIndex({
			indexName: 'siKey1-sk-index',
			partitionKey: {
				name: 'siKey1',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'sk',
				type: AttributeType.STRING,
			},
			projectionType: ProjectionType.KEYS_ONLY,
		});

		this.tableName = table.tableName;
		this.tableArn = table.tableArn;

		// EvenProcessor Lambda function

		const eventProcessorLambda = new NodejsFunction(this, 'EventProcessorLambda', {
			description: 'Results module event processor',
			entry: path.join(__dirname, '../../../typescript/packages/apps/results/src/lambda_eventbridge.ts'),
			functionName: `${namePrefix}-${props.moduleName}-eventProcessor`,
			runtime: Runtime.NODEJS_20_X,
			tracing: Tracing.ACTIVE,
			memorySize: 256,
			logRetention: RetentionDays.ONE_WEEK,
			timeout: Duration.minutes(5),
			environment: {
				EVENT_BUS_NAME: props.eventBusName,
				TABLE_NAME: table.tableName,
				STAC_SERVER_TOPIC_ARN: topic.topicArn,
				STAC_SERVER_FUNCTION_NAME: props.stacServerFunctionName,
				REGIONS_FUNCTION_NAME: props.regionsFunctionName,
				BUCKET_NAME: bucket.bucketName
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
		eventBus.grantPutEventsTo(eventProcessorLambda);
		table.grantReadWriteData(eventProcessorLambda);
		topic.grantPublish(eventProcessorLambda);
		regionsLambda.grantInvoke(eventProcessorLambda);
		bucket.grantRead(eventProcessorLambda);

		const deadLetterQueue = new Queue(this, 'DeadLetterQueue');
		deadLetterQueue.addToResourcePolicy(new PolicyStatement({
			sid: 'enforce-ssl',
			effect: Effect.DENY,
			principals: [new AnyPrincipal()],
			actions: ['sqs:*'],
			resources: [deadLetterQueue.queueArn],
			conditions: {
				'Bool': {
					'aws:SecureTransport': 'false'
				}
			}
		}));

		NagSuppressions.addResourceSuppressions([deadLetterQueue],
			[
				{
					id: 'AwsSolutions-SQS3',
					reason: 'This is the dead letter queue.'

				}
			],
			true);


		//Trigger Rule
		const resultsRule = new Rule(this, 'ResultsRule', {
			eventBus: eventBus,
			eventPattern: {
				detailType: [RESULTS_QUEUED_EVENT, RESULTS_FAILED_EVENT, RESULTS_STARTED_EVENT, RESULTS_COLLECTION_CREATE_EVENT, RESULTS_COMPLETED_EVENT]
			}
		});

		resultsRule.addTarget(
			new LambdaFunction(eventProcessorLambda, {
				deadLetterQueue: deadLetterQueue,
				maxEventAge: Duration.minutes(5),
				retryAttempts: 2
			})
		);

		NagSuppressions.addResourceSuppressions([eventProcessorLambda],
			[
				{
					id: 'AwsSolutions-L1',
					reason: 'Latest runtime not needed.'
				},
				{
					id: 'AwsSolutions-IAM4',
					appliesTo: [
						'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
					],
					reason: 'This policy is the one generated by CDK.'

				},
				{
					id: 'AwsSolutions-IAM5',
					appliesTo: [
						'Resource::*',
						'Action::s3:GetBucket*',
						'Action::s3:GetObject*',
						'Action::s3:List*',
						'Resource::arn:<AWS::Partition>:s3:::<S3SharedBucket4DDF4F1A>/*',
						'Resource::<ResultsImageProcessorLambda0378B9F4.Arn>:*',
						`Resource::arn:<AWS::Partition>:lambda:${region}:${accountId}:function:arcade-${props.environment}-regionsApi:*`,
						'Resource::<ResultsTable7B2FF7F9.Arn>/index/*'
					],
					reason: 'The resource condition in the IAM policy is generated by CDK, this only applies to xray:PutTelemetryRecords and xray:PutTraceSegments actions.'

				}
			],
			true);

	}
}

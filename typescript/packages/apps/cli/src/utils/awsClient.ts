import { SSMClient, SSMClientConfig } from '@aws-sdk/client-ssm';
import { CloudFormationClient, CloudFormationClientConfig } from '@aws-sdk/client-cloudformation';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { SecretsManagerClient, SecretsManagerClientConfig } from '@aws-sdk/client-secrets-manager';
import { LambdaClient, LambdaClientConfig } from '@aws-sdk/client-lambda';
import { EventBridgeClient, EventBridgeClientConfig } from '@aws-sdk/client-eventbridge';
import { ulid } from 'ulid';

const stsClient = new STSClient({ region: process.env.ARCADE_REGION ?? process.env.AWS_REGION });

async function getSSMClient(roleArn?: string): Promise<SSMClient> {
	const clientConfig: SSMClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let ssmClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);
		ssmClient = new SSMClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		ssmClient = new SSMClient({
			...clientConfig,
		});
	}
	return ssmClient;
}

async function getLambdaClient(roleArn?: string): Promise<LambdaClient> {
	const clientConfig: LambdaClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let lambdaClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);
		lambdaClient = new LambdaClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		lambdaClient = new LambdaClient({
			...clientConfig,
		});
	}
	return lambdaClient;
}

async function getSecretManagerClient(roleArn?: string): Promise<SecretsManagerClient> {
	const clientConfig: SecretsManagerClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let secretsManagerClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);
		secretsManagerClient = new SecretsManagerClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		secretsManagerClient = new SecretsManagerClient({
			...clientConfig,
		});
	}
	return secretsManagerClient;
}

async function getCloudFormationClient(roleArn?: string): Promise<CloudFormationClient> {
	const clientConfig: CloudFormationClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let cfClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);

		cfClient = new CloudFormationClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		cfClient = new CloudFormationClient({
			...clientConfig,
		});
	}
	return cfClient;
}

async function getEventBridgeClient(roleArn?: string): Promise<EventBridgeClient> {
	const clientConfig: EventBridgeClientConfig = { region: process.env.ARCADE_REGION ?? process.env.AWS_REGION };
	let cfClient;
	if (roleArn) {
		const command = new AssumeRoleCommand({
			RoleArn: roleArn,
			RoleSessionName: `arcade-cli-${ulid()}`,
		});

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { Credentials } = await stsClient.send(command);

		cfClient = new EventBridgeClient({
			...clientConfig,
			credentials: {
				accessKeyId: Credentials?.AccessKeyId || '',
				secretAccessKey: Credentials?.SecretAccessKey || '',
				sessionToken: Credentials?.SessionToken || '',
			},
		});
	} else {
		cfClient = new EventBridgeClient({
			...clientConfig,
		});
	}
	return cfClient;
}

export { getSSMClient, getCloudFormationClient, getSecretManagerClient, getLambdaClient, getEventBridgeClient };

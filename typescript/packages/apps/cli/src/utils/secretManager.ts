import { CreateSecretCommand, GetSecretValueCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSecretManagerClient } from './awsClient.js';

const createSecret = async (name: string, value: string, roleArn?: string): Promise<void> => {
	const smClient = await getSecretManagerClient(roleArn);
	try {
		await smClient.send(new CreateSecretCommand({ Name: name, SecretString: value }));
	} catch (error) {
		if (error.name !== 'ResourceExistsException') {
			throw new error();
		}
	}
};

const putSecret = async (name: string, value: string, roleArn?: string): Promise<void> => {
	const smClient = await getSecretManagerClient(roleArn);
	try {
		await smClient.send(new PutSecretValueCommand({ SecretId: name, SecretString: value }));
	} catch (error) {
		if (error.name !== 'ResourceNotFoundException') {
			throw new error();
		} else {
			await smClient.send(new CreateSecretCommand({ Name: name, SecretString: value }));
		}
	}
};

const getSecretValue = async (name: string, roleArn?: string): Promise<string> => {
	const smClient = await getSecretManagerClient(roleArn);
	const result = await smClient.send(new GetSecretValueCommand({ SecretId: name }));
	return result.SecretString;
};

export { createSecret, getSecretValue, putSecret };

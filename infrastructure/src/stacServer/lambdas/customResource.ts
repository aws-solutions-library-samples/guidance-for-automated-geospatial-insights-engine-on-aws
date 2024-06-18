import { GetFunctionConfigurationCommand, InvokeCommand, LambdaClient, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { CloudFormationCustomResourceEvent, } from "aws-lambda";
import { fromUtf8 } from '@aws-sdk/util-utf8-node';
import axios from 'axios';

const { ADMIN_SECRET_NAME, USER_SECRET_NAME, STAC_ENDPOINT, AWS_REGION, STAC_INGEST_LAMBDA, INGESTION_TOPIC_ARN, STAC_ROLE_NAME, STAC_API_LAMBDA, STAC_API_URL } = process.env

const secretsManagerClient = new SecretsManagerClient({ region: AWS_REGION });
const lambdaClient = new LambdaClient({ region: AWS_REGION });
const snsClient = new SNSClient({ region: AWS_REGION });

export interface Credentials {
	username: string;
	password: string;
}

const updateStacAPIEnvironmentVariables = async (): Promise<void> => {
	console.log(`stacServer.customResource> updateStacAPIEnvironmentVariables> in:`);
	const updateLambdaFutures = [STAC_API_LAMBDA, STAC_INGEST_LAMBDA].map(async (l: string) => {
		const currentFunctionConfiguration = await lambdaClient.send(new GetFunctionConfigurationCommand({ FunctionName: l }))
		// Trim the slash at the end of the string
		const formattedUrl = STAC_API_URL.endsWith('/') ? STAC_API_URL.replace(/\/$/, "") : STAC_API_URL;
		await lambdaClient.send(
			new UpdateFunctionConfigurationCommand({
				FunctionName: l,
				Environment: {
					Variables: {
						...currentFunctionConfiguration.Environment.Variables,
						STAC_API_URL: formattedUrl
					}
				}
			}),
		);
	})
	await Promise.all(updateLambdaFutures);
	console.log(`stacServer.customResource> updateStacAPIEnvironmentVariables> exit:`);
};


const createCollectionIndices = async (): Promise<void> => {
	console.log(`stacServer.customResource> createCollectionIndices> in:`);

	await lambdaClient.send(
		new InvokeCommand({
			FunctionName: STAC_INGEST_LAMBDA,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify({ create_indices: true })),
		}),
	);

	console.log(`stacServer.customResource> createCollectionIndices> exit:`);
};

const getCredentials = async (secretName: string): Promise<Credentials> => {
	console.log(`stacServer.customResource> getCredentials> in: secretName: ${secretName}`);

	const masterCredentials = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: secretName }));

	console.log(`stacServer.customResource> getCredentials> exit:`);
	return JSON.parse(masterCredentials.SecretString);
}

const linkRoleToUser = async (roleName: string, stacUsername: string, credentials: Credentials): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchUser> in: roleName: ${roleName}, stacUsername: ${stacUsername}`);

	const payload = { users: [stacUsername] };

	const result = await axios.put(`https://${STAC_ENDPOINT}/_plugins/_security/api/rolesmapping/${roleName}` as string, payload, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: credentials.username,
			password: credentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchUser> exit> result: ${JSON.stringify(result.data)}`);
}

const createOpenSearchUser = async (userCredentials: Credentials, adminCredentials: Credentials): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchUser> in:`);

	const result = await axios.put(`https://${STAC_ENDPOINT}/_plugins/_security/api/internalusers/${userCredentials.username}` as string, { password: userCredentials.password }, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: adminCredentials.username,
			password: adminCredentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchUser> exit> result: ${JSON.stringify(result.data)}`);
}
const createOpenSearchRole = async (roleName: string, credentials: Credentials): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchRole> in :`);

	const payload = {
		cluster_permissions: ['cluster_composite_ops', 'cluster:monitor/health'],
		index_permissions: [
			{
				index_patterns: ['*'],
				allowed_actions: ['indices_all'],
			},
		],
		tenant_permissions: [
			{
				tenant_patterns: ['global_tenant'],
				allowed_actions: ['kibana_all_read'],
			},
		],
	};

	const result = await axios.put(`https://${STAC_ENDPOINT}/_plugins/_security/api/roles/${roleName}` as string, payload, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: credentials.username,
			password: credentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchRole> exit> result: ${JSON.stringify(result.data)}`);
}

const init = async (): Promise<void> => {
	console.log(`stacServer.customResource> init> in :`);
	// get the credentials for admin and the created credentials for stac user (we're going to create the later in OpenSearch)
	const [credentials, userCredentials] = await Promise.all([getCredentials(ADMIN_SECRET_NAME), getCredentials(USER_SECRET_NAME)])
	// create the role and users that will be used by the ingestion lambda
	await createOpenSearchUser(userCredentials, credentials);
	await createOpenSearchRole(STAC_ROLE_NAME, credentials);
	await linkRoleToUser(STAC_ROLE_NAME, userCredentials.username, credentials);

	// create index
	await createCollectionIndices();

	// publish catalog event
	await createCatalog();

	// update StacAPI lambda environment variables
	await updateStacAPIEnvironmentVariables();

	console.log(`stacServer.customResource> init> exit :`);
}

const createCatalog = async (): Promise<void> => {
	console.log(`stacServer.customResource> createCatalog> in :`);
	const catalog = {
		id: 'catalog_arcade',
		type: 'Catalog',
		stac_version: '1.0.0',
		links: [
			{
				rel: 'self',
				href: '../catalog.json',
				type: 'application/json',
				title: 'ARCADE Catalog',
			},
		],
		description: 'Default Catalog for ARCADE',
		title: 'ARCADE Catalog',
	};

	await snsClient.send(
		new PublishCommand({
			Message: JSON.stringify(catalog),
			TopicArn: INGESTION_TOPIC_ARN
		})
	);

	console.log(`stacServer.customResource> createCatalog> exit:`);
}

export const handler = async (event: CloudFormationCustomResourceEvent): Promise<any> => {
	console.log(`stacServer.customResource > handler > in : ${JSON.stringify(event)}`);
	try {
		switch (event.RequestType) {
			case "Create":
				await init();
				break;
			case "Update":
				//  the call to init() is idempotent
				await init();
				break;
			case "Delete":
				break;
		}
	} catch (e) {
		console.log(`stacServer.customResource > error : ${e}`);
	}

};

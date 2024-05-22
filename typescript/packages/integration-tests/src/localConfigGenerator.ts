/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { CloudFormationClient, ListExportsCommand } from '@aws-sdk/client-cloudformation';
import * as fs from 'fs';

const { ENVIRONMENT, AWS_REGION } = process.env;

if (!ENVIRONMENT || !AWS_REGION) {
	throw new Error(`Environment variable ENVIRONMENT or AWS_REGION is not specified.`);
}

const ssm = new SSMClient({ region: process.env['AWS_REGION'] });
const cloudformation = new CloudFormationClient({ region: process.env['AWS_REGION'] });
const secretsManager = new SecretsManagerClient({ region: process.env['AWS_REGION'] })

const getValues = async (module: string, mapping: Record<string, string>) => {
	for (const key in mapping) {
		const prefix = `/arcade/${ENVIRONMENT}/${module}/`;
		const name = `${prefix}${mapping[key]}`;
		try {
			const response = await ssm.send(
				new GetParameterCommand({
					Name: name,
					WithDecryption: false,
				})
			);
			if (response) {
				outputFile += `${key}=${response.Parameter?.Value}\r\n`;
			}
		} catch (e) {
			throw new Error(`
			*************************************************************************************************************************************************************
				Parameter ${name} not Found!
				This means either the ENVIRONMENT / AWS_REGION is incorrect, or the AWS credentials being used are invalid.
			*************************************************************************************************************************************************************
`);
		}
	}
};

let outputFile = `
NODE_ENV=local
AWS_XRAY_CONTEXT_MISSING=IGNORE_ERROR
STAC_OS_SECRET_NAME=stac-server-${ENVIRONMENT}-opensearch-user-creds
`;

// Get the API URL for the elasticsearch
let keepGoing = true, nextToken: string;
while (keepGoing) {
	const result = await cloudformation.send(new ListExportsCommand({ NextToken: nextToken }))
	result.Exports.forEach(e => {
		if (e.Name === `sls-stac-server-${ENVIRONMENT}-ServiceEndpoint`) {
			outputFile += `STAC_API_URL=${e.Value}/\r\n`;
		} else if (e.Name === `stac-server-${ENVIRONMENT}-os-endpoint`) {
			outputFile += `STAC_OS_SERVER_URL=${e.Value}\r\n`;
		}
	});

	nextToken = result.NextToken
	keepGoing = nextToken !== undefined;
}


const secretResponse = await secretsManager.send(new GetSecretValueCommand({ SecretId: `arcade/${ENVIRONMENT}/shared/apiKey` }))

const { apiKey } = JSON.parse(secretResponse.SecretString);

outputFile += `STAC_API_KEY=${apiKey}\r\n`;

await getValues('shared', {
	EVENT_BUS_NAME: 'eventBusName',
});

await getValues('regions', {
	ARCADE_REGIONS_BASE_URL: 'apiUrl',
});

await getValues('results', {
	ARCADE_RESULTS_BASE_URL: 'apiUrl',
});

await getValues('notifications', {
	ARCADE_NOTIFICATIONS_BASE_URL: 'apiUrl',
});

await getValues('shared', {
	COGNITO_USER_POOL_ID: 'cognitoUserPoolId',
});

await getValues('shared', {
	COGNITO_CLIENT_ID: 'cognitoUserPoolClientId',
});

fs.writeFileSync('local.env', outputFile);

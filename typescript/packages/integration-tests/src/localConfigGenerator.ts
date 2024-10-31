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
import * as fs from 'fs';

const { ENVIRONMENT, AWS_REGION } = process.env;

if (!ENVIRONMENT || !AWS_REGION) {
	throw new Error(`Environment variable ENVIRONMENT or AWS_REGION is not specified.`);
}

const ssm = new SSMClient({ region: process.env['AWS_REGION'] });

const getValues = async (module: string, mapping: Record<string, string>) => {
	for (const key in mapping) {
		const prefix = `/agie/${ENVIRONMENT}/${module}/`;
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
`;

await getValues('stacServer', {
	STAC_API_URL: 'apiUrl',
	STAC_OS_SERVER_URL: 'openSearchUrl',
	STAC_OS_SECRET_NAME: 'administratorSecretName',
});

await getValues('shared', {
	EVENT_BUS_NAME: 'eventBusName',
});

await getValues('regions', {
	AGIE_REGIONS_BASE_URL: 'apiUrl',
});

await getValues('results', {
	AGIE_RESULTS_BASE_URL: 'apiUrl',
});

await getValues('executor', {
	AGIE_EXECUTOR_BASE_URL: 'apiUrl',
});

await getValues('notifications', {
	AGIE_NOTIFICATIONS_BASE_URL: 'apiUrl',
});

await getValues('shared', {
	COGNITO_USER_POOL_ID: 'cognitoUserPoolId',
});

await getValues('shared', {
	COGNITO_CLIENT_ID: 'cognitoUserPoolClientId',
});

fs.writeFileSync('local.env', outputFile);

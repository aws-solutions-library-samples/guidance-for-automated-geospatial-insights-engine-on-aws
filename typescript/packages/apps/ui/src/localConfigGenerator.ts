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

import * as fs from 'fs';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';

const { ENVIRONMENT, AWS_REGION } = process.env;

if (!ENVIRONMENT || !AWS_REGION) {
	throw new Error(`Environment Variable ENVIRONMENT or AWS_REGION is not being specified`);
}

console.log(`ENVIRONMENT: ${ENVIRONMENT}\r\nREGION: ${AWS_REGION}`);

const stsClient = new STSClient({ region: AWS_REGION });

let credentials: any;

if (process.env['AWS_CREDS_TARGET_ROLE']) {
	const results = await stsClient.send(new AssumeRoleCommand({
		RoleArn: process.env['AWS_CREDS_TARGET_ROLE'],
		RoleSessionName: 'generateConfigSession',
		DurationSeconds: 900
	}));
	credentials = {
		accessKeyId: results.Credentials!.AccessKeyId,
		secretAccessKey: results.Credentials!.SecretAccessKey,
		sessionToken: results.Credentials!.SessionToken
	};
}

const ssmClient = new SSMClient({ region: AWS_REGION, credentials });

const agieConfiguration: Record<string, string> = {
	'NODE_ENV': 'local',
	VITE_LOCATION_SERVICE_BASE_MAP_NAME: `agie.${ENVIRONMENT}.baseNavigationMap`,
	VITE_LOCATION_SERVICE_SAT_MAP_NAME: `agie.${ENVIRONMENT}.baseSatelliteMap`,
	VITE_COGNITO_USER_POOL_REGION: AWS_REGION,
	VITE_LOCATION_SERVICE_MAP_REGION: AWS_REGION,
	VITE_REGION: AWS_REGION
};

const getValues = async (module: string, mapping: Record<string, string>) => {
	for (const key in mapping) {
		const prefix = `/agie/${ENVIRONMENT}/${module}/`;
		const name = `${prefix}${mapping[key]}`;
		try {
			const response = await ssmClient.send(new GetParameterCommand({
				Name: name, WithDecryption: false
			}));
			agieConfiguration[key] = response.Parameter?.Value!;
		} catch (e) {
			throw new Error(`Parameter ${name} NOT Found !!!`);
		}
	}
};

await Promise.all([
	getValues('shared', {
		VITE_COGNITO_USER_POOL_ID: 'cognitoUserPoolId',
		VITE_COGNITO_USER_POOL_CLIENT_ID: 'cognitoUserPoolClientId',
	}),
	getValues('regions', {
		VITE_REGIONS_API_URL: 'apiUrl'
	}),
	getValues('stacServer', {
		VITE_STAC_API_ENDPOINT: 'apiUrl'
	}),
	getValues('ui', {
		VITE_UI_REST_API_URL: 'apiUrl',
		VITE_IDENTITY_POOL_ID: 'identityPoolId',
	})
]);

fs.writeFileSync('.env.local', Object.entries(agieConfiguration).map(([key, value]) => `${key}=${value}`).join('\r\n'));

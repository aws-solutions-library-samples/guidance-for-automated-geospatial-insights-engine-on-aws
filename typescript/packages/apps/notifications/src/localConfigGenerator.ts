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
import { STS } from "@aws-sdk/client-sts";

const { ENVIRONMENT, AWS_REGION } = process.env;

if (!ENVIRONMENT || !AWS_REGION) {
	throw new Error(`Environment variable ENVIRONMENT or AWS_REGION is not specified.`);
}

const ssm = new SSMClient({ region: process.env['AWS_REGION'] });

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

let accountId, region;
const sts = new STS({});
try {
	const callerIdentity = await sts.getCallerIdentity({});
	accountId = callerIdentity.Account;
	region = await sts.config.region();
} catch (Exception) {
	console.log(`Could not retrieve caller identity when fetching environment`);
}

let outputFile = `
NODE_ENV=local
AWS_ACCOUNT_ID=${accountId}
AWS_XRAY_CONTEXT_MISSING=IGNORE_ERROR
`;


await getValues('shared', {
	EVENT_BUS_NAME: 'eventBusName',
});

await getValues('notifications', {
	TABLE_NAME: 'tableName',
});

fs.writeFileSync('.env', outputFile);

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

import { authorizeUser } from './auth.js';
import { getParameter } from './ssm.js';

const [environment, username, password, newPassword] = process.argv.slice(2);

console.log(environment, username, password, newPassword);
if (process.argv.length < 3) {
	throw new Error('Missing arguments\r\nHow to run the command: \r\n> npm run generate:token -- <environment> <username> <password> ');
}
(async () => {
	process.env.COGNITO_CLIENT_ID = await getParameter(`/agie/${environment}/shared/cognitoUserPoolClientId`);
	process.env.COGNITO_USER_POOL_ID = await getParameter(`/agie/${environment}/shared/cognitoUserPoolId`);
	console.log('authorizeUser');
	const token = await authorizeUser(username, password, newPassword);
	console.log(token);
})().catch((e) => console.log(e));

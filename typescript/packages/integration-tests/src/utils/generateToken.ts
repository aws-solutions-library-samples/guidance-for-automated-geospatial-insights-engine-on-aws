import { authorizeUser } from './auth.js';
import { getParameter } from './ssm.js';

const [environment, username, password, newPassword] = process.argv.slice(2);

console.log(environment, username, password, newPassword);
if (process.argv.length < 3) {
	throw new Error('Missing arguments\r\nHow to run the command: \r\n> npm run generate:token -- <environment> <username> <password> ');
}
(async () => {
	process.env.COGNITO_CLIENT_ID = await getParameter(`/arcade/${environment}/shared/cognitoUserPoolClientId`);
	process.env.COGNITO_USER_POOL_ID = await getParameter(`/arcade/${environment}/shared/cognitoUserPoolId`);
	console.log('authorizeUser');
	const token = await authorizeUser(username, password, newPassword);
	console.log(token);
})().catch((e) => console.log(e));

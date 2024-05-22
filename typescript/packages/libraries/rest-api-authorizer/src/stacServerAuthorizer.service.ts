import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import ow from 'ow';
import { BaseLogger } from 'pino';

// Global variable to store the secret
let cachedSecret = undefined;

export class StacServerAuthorizer {
	public constructor(
		readonly logger: BaseLogger,
		readonly policyStoreId: string,
		readonly userPoolId: string,
		readonly clientId: string,
		readonly secretId: string,
		readonly secretManagerClient: SecretsManagerClient
	) {}

	public async process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyEvent | APIGatewayProxyResult> {
		this.logger.debug(`STACServerAuthorizer> process> in> event:${JSON.stringify(event)}`);

		// Validation
		ow(event, 'request', ow.object.nonEmpty);
		ow(event.headers, 'request headers', ow.object.nonEmpty);
		ow(event.resource, 'request resource', ow.string.nonEmpty);
		ow(event.requestContext?.httpMethod, 'request httpMethod', ow.string.nonEmpty);

		let authType: AuthType = 'cognito';
		let token: string;
		if (!Object.keys(event.headers).includes('X-API-KEY') && !Object.keys(event.headers).includes('x-api-key')) {
			// Depending on http1.1 or http2, API Gateway provides different case on the authorization header.
			const authorizationHeader = event.headers?.Authorization ?? event.headers?.authorization;
			ow(authorizationHeader, 'authorization header', ow.string.nonEmpty);
			token = authorizationHeader.replace('Bearer ', '');
		} else {
			token = event.headers['X-API-KEY'] ?? event.headers['x-api-key'];
			ow(token, ow.string.nonEmpty);
			authType = 'secret';
		}
		// Verifier that expects valid access tokens:
		const verifier = CognitoJwtVerifier.create({
			userPoolId: this.userPoolId,
			tokenUse: 'id',
			clientId: this.clientId,
		});

		try {
			if (authType === 'cognito') {
				await verifier.verify(token);
			} else {
				// Get the secret if not found
				if (!cachedSecret) {
					cachedSecret = await this.secretManagerClient.send(new GetSecretValueCommand({ SecretId: this.secretId }));
				}
				const credentials: APICredentials = JSON.parse(cachedSecret.SecretString);
				const decodedCred = Buffer.from(token, 'base64').toString('utf-8');
				if (decodedCred !== credentials.apiKey) {
					const result: APIGatewayProxyResult = {
						statusCode: 403,
						body: 'Invalid token',
					};
					return result;
				}
			}

			return event;
		} catch (e) {
			this.logger.error(`STACServerAuthorizer> process> Invalid token: ${e}`);
			// throw new UnauthorizedError('Invalid token');
			const result: APIGatewayProxyResult = {
				statusCode: 403,
				body: 'Invalid token',
			};
			return result;
		}
	}
}

export type AuthType = 'cognito' | 'secret';

interface APICredentials {
	apiKey: string;
}

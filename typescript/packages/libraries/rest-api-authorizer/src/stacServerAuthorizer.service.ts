import { UnauthorizedError } from '@arcade/resource-api-base';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import ow from 'ow';
import { BaseLogger } from 'pino';

export class StacServerAuthorizer {
	public constructor(readonly logger: BaseLogger, readonly policyStoreId: string, readonly userPoolId: string, readonly clientId: string) {}

	public async process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyEvent | APIGatewayProxyResult> {
		this.logger.debug(`STACServerAuthorizer> process> in> event:${JSON.stringify(event)}`);

		// Validation
		ow(event, 'request', ow.object.nonEmpty);
		ow(event.headers, 'request headers', ow.object.nonEmpty);

		// Depending on http1.1 or http2, API Gateway provides different case on the authorization header.
		const authorizationHeader = event.headers?.Authorization ?? event.headers?.authorization;

		ow(authorizationHeader, 'authorization header', ow.string.nonEmpty);
		ow(event.resource, 'request resource', ow.string.nonEmpty);
		ow(event.requestContext?.httpMethod, 'request httpMethod', ow.string.nonEmpty);

		const token = authorizationHeader.replace('Bearer ', '');

		// Verifier that expects valid access tokens:
		const verifier = CognitoJwtVerifier.create({
			userPoolId: this.userPoolId,
			tokenUse: 'id',
			clientId: this.clientId,
		});

		try {
			await verifier.verify(token);
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

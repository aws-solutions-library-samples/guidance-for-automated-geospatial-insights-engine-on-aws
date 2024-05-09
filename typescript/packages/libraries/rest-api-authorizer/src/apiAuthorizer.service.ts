import { UnauthorizedError } from '@arcade/resource-api-base';
import { Decision, IsAuthorizedWithTokenCommand, IsAuthorizedWithTokenCommandOutput, VerifiedPermissionsClient } from '@aws-sdk/client-verifiedpermissions';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { decomposeUnverifiedJwt } from 'aws-jwt-verify/jwt';
import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import ow from 'ow';
import { BaseLogger } from 'pino';

export type ArcadeIdentity = {
	sub: string;
	email: string;
	role: string;
	phoneNumber: string;
};

export type AuthDecision = {
	identity: ArcadeIdentity;
	decision: string;
};

export type JSONValue = string | number | boolean | { [x: string]: JSONValue } | Array<JSONValue>;

export class ApiAuthorizer {
	public constructor(
		readonly logger: BaseLogger,
		readonly avpClient: VerifiedPermissionsClient,
		readonly policyStoreId: string,
		readonly userPoolId: string,
		readonly clientId: string
	) {}

	public async process(event: APIGatewayRequestAuthorizerEvent, actionMap: JSONValue): Promise<Decision> {
		this.logger.debug(`ApiAuthorizer> process> in> event:${JSON.stringify(event)}`);

		// Depending on http1.1 or http2, API Gateway provides different case on the authorization header.
		const authorizationHeader = event.headers?.Authorization ?? event.headers?.authorization;

		// Validation
		ow(event, 'request', ow.object.nonEmpty);
		ow(event.type, 'request type', ow.string.equals('REQUEST'));
		ow(event.headers, 'request headers', ow.object.nonEmpty);
		ow(authorizationHeader, 'authorization header', ow.string.nonEmpty);
		ow(event.methodArn, 'request methodArn', ow.string.nonEmpty);
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
		} catch (e) {
			this.logger.error(`ApiAuthorizer> process> Invalid token: ${e}`);
			throw new UnauthorizedError('Invalid token');
		}

		try {
			const response = await this._isAuthorizedWithToken(event, actionMap, token);
			this.logger.debug(`ApiAuthorizer> process> exit:${response}`);
			return response;
		} catch (err) {
			this.logger.debug(`ApiAuthorizer> process> err: ${err}`);
			throw err;
		}
	}

	public extractIdentity(authorizationHeader: string): ArcadeIdentity {
		this.logger.debug(`ApiAuthorizer> extractIdentity> in> authorizationHeader:${authorizationHeader}`);

		ow(authorizationHeader, ow.string.nonEmpty);

		const token = authorizationHeader?.replace('Bearer ', '');
		const payload = decomposeUnverifiedJwt(token)?.payload;
		const identity: ArcadeIdentity = {
			sub: payload?.['sub']?.toString() ?? '?',
			email: payload?.['email']?.toString() ?? '?',
			role: payload?.['custom:role']?.toString() ?? '?',
			phoneNumber: payload?.['phone_number']?.toString() ?? '?',
		};
		this.logger.debug(`ApiAuthorizer> extractIdentity> exit: ${JSON.stringify(identity)}`);
		return identity;
	}

	public buildAPIGatewayAuthorizerResult(identity: ArcadeIdentity, decision: Decision, methodArn: string): APIGatewayAuthorizerResult {
		const result: APIGatewayAuthorizerResult = {
			principalId: identity?.sub,
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Action: 'execute-api:Invoke',
						Effect: decision === 'ALLOW' ? 'Allow' : 'Deny',
						Resource: decision === 'ALLOW' ? methodArn : '*',
					},
				],
			},
			context: identity,
		};
		return result;
	}

	public _identifyAction(httpMethod: string, path: string, actionMap: JSONValue): string {
		this.logger.debug(`ApiAuthorizer> _identifyAction> in> httpMethod:${httpMethod}, path:${path}`);
		const pathParts = path?.split('/');

		let map = actionMap;

		for (let i = 1; i < pathParts.length; i++) {
			this.logger.trace(`ApiAuthorizer> _identifyAction>  map:${JSON.stringify(map)}`);
			const pathPart = pathParts[i];
			this.logger.trace(`ApiAuthorizer> _identifyAction> pathPart:${pathPart}`);

			if (map[pathPart]) {
				// see if we have an exact match in the path
				map = map[pathPart];
				this.logger.trace(`ApiAuthorizer> _identifyAction> exact match`);
			} else if (map['*']) {
				// see if we have a wildcard match
				map = map['*'];
				this.logger.trace(`ApiAuthorizer> _identifyAction> wildcard match`);
			} else {
				// match
				map = undefined;
				this.logger.trace(`ApiAuthorizer> _identifyAction> no match`);
				break;
			}
		}
		this.logger.trace(`ApiAuthorizer> _identifyAction>  final map:${JSON.stringify(map)}`);

		const action = map?.[httpMethod] ?? 'UnrecognizedAction';
		this.logger.debug(`ApiAuthorizer> _identifyAction> exit:${action}`);
		return action;
	}

	public async _isAuthorizedWithToken(event: APIGatewayRequestAuthorizerEvent, actionMap: JSONValue, token: string): Promise<Decision> {
		this.logger.debug(`ApiAuthorizer> isAuthorizedWithToken> in>`);

		const actionId = this._identifyAction(event.requestContext.httpMethod, event.path, actionMap);

		const command = new IsAuthorizedWithTokenCommand({
			policyStoreId: this.policyStoreId,
			identityToken: token,
			action: {
				actionType: `Arcade::Action`,
				actionId,
			},
			resource: {
				entityType: `Arcade::Resource`,
				entityId: event.path,
			},
			entities: {
				entityList: [
					{
						identifier: {
							entityType: `Arcade::Resource`,
							entityId: event.path,
						},
					},
				],
			},
		});

		this.logger.trace(`ApiAuthorizer> isAuthorizedWithToken> request: ${JSON.stringify(command)}`);
		const result: IsAuthorizedWithTokenCommandOutput = await this.avpClient.send(command);
		this.logger.trace(`ApiAuthorizer> isAuthorizedWithToken> response: ${JSON.stringify(result)}`);

		if (!result.decision) {
			this.logger.error(result.errors);
			throw new UnauthorizedError('Failed to make decision');
		}

		this.logger.debug(`ApiAuthorizer> isAuthorizedWithToken> exit: ${JSON.stringify(result.decision)}`);
		return result.decision;
	}
}

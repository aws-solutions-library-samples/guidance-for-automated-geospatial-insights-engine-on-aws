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

import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { jwtDecode } from 'jwt-decode';
import type { SecurityContext, SecurityScope } from './scopes.js';

export type CognitoAuthToken = {
	email: string;
	role: string;
	sub: string;
	phone_number: string;
};

/**
 * Extracts the users email and userId from the Cognito ID token.
 *
 * If running in `development` mode, these are extracted from the local token.
 */
export const authzPlugin = fp(async (app: any): Promise<void> => {
	/**
	 * Resets the `authz` attributes per request.
	 */
	app.decorateRequest('authz', null);

	/**
	 * performs the extraction per request.
	 */
	app.addHook('onRequest', async (req: FastifyRequest, _reply: FastifyReply) => {
		app.log.debug('authz> onRequest> in>');

		let email: string | undefined, sub: string | undefined, phoneNumber: string | undefined;
		let role: SecurityScope;

		if (req.url.startsWith('/static')) {
			return;
		} else if (req.url.startsWith('/swagger-docs')) {
			return;
		}

		// when in anything but local mode we extract the user details from the cognito provided and validated id token
		if (process.env['NODE_ENV'] !== 'local') {
			// retrieve the original aws lambda event
			let lambdaEvent;
			try {
				lambdaEvent = JSON.parse(decodeURIComponent(req.headers['x-apigateway-event'] as string));
			} catch (e) {
				throw new UnauthorizedError('Missing or malformed authorization token.');
			}

			// extract the users claims from the ID token (provided by the COGNITO_USER_POOLS integration)
			email = lambdaEvent?.requestContext?.authorizer?.['email'] as string;
			sub = lambdaEvent?.requestContext?.authorizer?.['sub'] as string;
			phoneNumber = lambdaEvent?.requestContext?.authorizer?.['phoneNumber'] as string;
			role = lambdaEvent?.requestContext?.authorizer?.['role'] as SecurityScope;
		} else {
			// if in local mode, to simplify local development we extract from user provided headers
			app.log.warn(`authz> onRequest> running in local development mode which means Cognito authorization is not enabled!!!`);

			if (!req.headers.authorization) {
				throw new UnauthorizedError('Missing or malformed authorization token.');
			}

			let jws = req.headers.authorization?.replace('Bearer ', '');
			const decodedToken = jwtDecode<CognitoAuthToken>(jws);

			/*
			 * Semgrep issue :  https://sg.run/wx8x
			 * ignore reason : JWT token is verified by APIGW in a prior step and this issue is invalid
			 */
			email = decodedToken.email; // nosemgrep
			phoneNumber = decodedToken.phone_number; // nosemgrep
			sub = decodedToken.sub; // nosemgrep
			// TODO: figure out how the role is passed
			role = decodedToken['custom:role'] as SecurityScope;
		}

		// place the group roles and email on the request in case a handler needs to perform finer grained access control
		req.authz = {
			email,
			role,
			phoneNumber,
			sub,
		};
		app.log.debug(`authz> onRequest> req.authz: ${JSON.stringify(req.authz)}`);
	});
});

class UnauthorizedError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'UnauthorizedError';
	}
}

declare module 'fastify' {
	interface FastifyRequest {
		authz: SecurityContext;
	}
}

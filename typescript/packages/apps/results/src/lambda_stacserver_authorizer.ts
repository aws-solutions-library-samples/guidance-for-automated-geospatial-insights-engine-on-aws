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

import { StacServerAuthorizer } from '@arcade/rest-api-authorizer';
import { AwilixContainer } from 'awilix';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyEvent | APIGatewayProxyResult> {
	app.log.debug(`lambda> STACServerAuthorizer >handler> in: ${JSON.stringify(event)}`);
	const stacServerAuthorizer: StacServerAuthorizer = di.resolve('stacServerAuthorizer');

	let response: APIGatewayProxyEvent | APIGatewayProxyResult;
	try {
		response = await stacServerAuthorizer.process(event);
	} catch (e) {
		// swallow
	}

	app.log.debug(`lambda> STACServerAuthorizer >handler> exit: ${JSON.stringify(response)}`);
	return response;
}

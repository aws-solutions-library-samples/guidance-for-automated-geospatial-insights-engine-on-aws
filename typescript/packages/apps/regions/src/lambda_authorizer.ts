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

import { ApiAuthorizer, ArcadeIdentity } from '@arcade/rest-api-authorizer';
import { Decision } from '@aws-sdk/client-verifiedpermissions';
import { AwilixContainer } from 'awilix';
import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const ACTION_MAP = {
	groups: {
		GET: 'ListGroups',
		POST: 'CreateGroup',
		'*': {
			GET: 'DescribeGroup',
			PATCH: 'UpdateGroup',
			DELETE: 'DeleteGroup',
			regions: {
				POST: 'CreateRegion',
			},
		},
	},
	regions: {
		GET: 'ListRegions',
		'*': {
			GET: 'DescribeRegion',
			PATCH: 'UpdateRegion',
			DELETE: 'DeleteRegion',
			polygons: {
				POST: 'CreatePolygon',
			},
		},
	},
	polygons: {
		GET: 'ListPolygons',
		'*': {
			GET: 'DescribePolygon',
			PATCH: 'UpdatePolygon',
			DELETE: 'DeletePolygon',
			states: {
				POST: 'CreateState',
			},
		},
	},
	states: {
		GET: 'ListStates',
		'*': {
			GET: 'DescribeState',
			PATCH: 'UpdateState',
			DELETE: 'DeleteState',
		},
	},
};

export async function handler(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
	const apiAuthorizer: ApiAuthorizer = di.resolve('apiAuthorizer');

	let decision: Decision;
	try {
		decision = await apiAuthorizer.process(event, ACTION_MAP);
	} catch (e) {
		// swallow
	}

	let identity: ArcadeIdentity;
	try {
		identity = apiAuthorizer.extractIdentity(event?.headers?.authorization);
	} catch (e) {
		// swallow
	}

	const response = apiAuthorizer.buildAPIGatewayAuthorizerResult(identity, decision, event.methodArn);

	app.log.debug(`lambda> handler> exit: ${JSON.stringify(response)}`);
	return response;
}

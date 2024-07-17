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

import { IsAuthorizedWithTokenCommand, VerifiedPermissionsClient } from '@aws-sdk/client-verifiedpermissions';
import { APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiAuthorizer } from './apiAuthorizer.service.js';

describe('ApiAuthorizer', () => {
	const mockedVerifiedPermissionsClient = mockClient(VerifiedPermissionsClient);
	let underTest: ApiAuthorizer;

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
	};

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';
		mockedVerifiedPermissionsClient.reset();
		underTest = new ApiAuthorizer(logger, mockedVerifiedPermissionsClient as unknown as VerifiedPermissionsClient, 'mockedPolicyStoreId', 'mockedUserPoolId', 'mockedClientId');
	});

	it('identifyAction - 1 level exact match', () => {
		const httpMethod = 'GET';
		const path = '/groups';

		const actual = underTest._identifyAction(httpMethod, path, ACTION_MAP);
		expect(actual).toEqual('ListGroups');
	});

	it('identifyAction - 2 level wildcard', () => {
		const httpMethod = 'GET';
		const path = '/groups/123';

		const actual = underTest._identifyAction(httpMethod, path, ACTION_MAP);
		expect(actual).toEqual('DescribeGroup');
	});

	it('identifyAction - 3 level exact match', () => {
		const httpMethod = 'POST';
		const path = '/groups/123/regions';

		const actual = underTest._identifyAction(httpMethod, path, ACTION_MAP);
		expect(actual).toEqual('CreateRegion');
	});

	it('identifyAction - 4 level invalid', () => {
		const httpMethod = 'GET';
		const path = '/groups/123/regions/456';

		const actual = underTest._identifyAction(httpMethod, path, ACTION_MAP);
		expect(actual).toEqual('UnrecognizedAction');
	});

	it('identifyAction - 5 level invalid', () => {
		const httpMethod = 'GET';
		const path = '/groups/123/regions/456/invalid';

		const actual = underTest._identifyAction(httpMethod, path, ACTION_MAP);
		expect(actual).toEqual('UnrecognizedAction');
	});

	it('isAuthorizedWithToken', async () => {
		const event: APIGatewayRequestAuthorizerEvent = {
			type: 'REQUEST',
			httpMethod: undefined,
			path: '/groups/01hwn3wbd67ntssw5jxmbbdg0e',
			headers: {
				Authorization: 'Bearer mockedJwt',
			},
			methodArn: undefined,
			resource: undefined,
			multiValueHeaders: undefined,
			pathParameters: undefined,
			queryStringParameters: undefined,
			multiValueQueryStringParameters: undefined,
			stageVariables: undefined,
			requestContext: {
				httpMethod: 'GET',
				accountId: undefined,
				apiId: undefined,
				authorizer: undefined,
				protocol: undefined,
				identity: undefined,
				path: undefined,
				stage: undefined,
				requestId: undefined,
				requestTimeEpoch: undefined,
				resourceId: undefined,
				resourcePath: undefined,
			},
		};

		mockedVerifiedPermissionsClient.on(IsAuthorizedWithTokenCommand).resolvesOnce({
			decision: 'ALLOW',
		});

		const token = event.headers.Authorization.replace('Bearer ', '');
		const actual = await underTest._isAuthorizedWithToken(event, ACTION_MAP, token);
		expect(actual).toEqual('ALLOW');

		const spy = mockedVerifiedPermissionsClient.commandCalls(IsAuthorizedWithTokenCommand)[0];
		expect(spy.args[0].input).toStrictEqual({
			policyStoreId: 'mockedPolicyStoreId',
			identityToken: 'mockedJwt',
			action: { actionType: 'Arcade::Action', actionId: 'DescribeGroup' },
			resource: { entityType: 'Arcade::Resource', entityId: '/groups/01hwn3wbd67ntssw5jxmbbdg0e' },
			entities: {
				entityList: [
					{
						identifier: { entityType: 'Arcade::Resource', entityId: '/groups/01hwn3wbd67ntssw5jxmbbdg0e' },
					},
				],
			},
		});
	});
});

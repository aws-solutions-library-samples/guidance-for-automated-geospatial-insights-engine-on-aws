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

import { diContainer } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import pkg from 'aws-xray-sdk';
const { captureAWSv3Client } = pkg;

import { VerifiedPermissionsClient } from '@aws-sdk/client-verifiedpermissions';
import type { FastifyBaseLogger } from 'fastify';
import { ApiAuthorizer } from '../apiAuthorizer.service.js';

// declaration merging to allow for typescript checking
declare module '@fastify/awilix' {
	interface Cradle extends AuthCradle {}
}

export interface AuthCradle {
	verifiedPermissionsClient: VerifiedPermissionsClient;
	apiAuthorizer: ApiAuthorizer;
}

// factories for instantiation of 3rd party objects
class VerifiedPermissionsClientFactory {
	public static create(region: string): VerifiedPermissionsClient {
		return captureAWSv3Client(new VerifiedPermissionsClient({ region }));
	}
}

export function registerAuthAwilix(logger: FastifyBaseLogger) {
	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON,
	};

	const awsRegion = process.env['AWS_REGION'];
	const policyStoreId = process.env['POLICY_STORE_ID'];
	const userPoolId = process.env['USER_POOL_ID'];
	const clientId = process.env['CLIENT_ID'];

	// then we can register our classes with the DI container
	diContainer.register({
		verifiedPermissionsClient: asFunction(() => VerifiedPermissionsClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),

		apiAuthorizer: asFunction((c: AuthCradle) => new ApiAuthorizer(logger, c.verifiedPermissionsClient, policyStoreId, userPoolId, clientId), {
			...commonInjectionOptions,
		}),
	});
}

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

import { asFunction, Lifetime } from 'awilix';
import fp from 'fastify-plugin';

import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import pkg from 'aws-xray-sdk';

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
	interface Cradle {
		eventBridgeClient: EventBridgeClient;
	}
}

class EventBridgeClientFactory {
	public static create(region: string): EventBridgeClient {
		const eventBridge = captureAWSv3Client(
			new EventBridgeClient({
				region,
			})
		);
		return eventBridge;
	}
}

export default fp<FastifyAwilixOptions>(async (app): Promise<void> => {
	// first register the DI plugin
	await app.register(fastifyAwilixPlugin, {
		disposeOnClose: true,
		disposeOnResponse: false,
	});

	const commonInjectionOptions = {
		lifetime: Lifetime.SINGLETON,
	};

	const awsRegion = process.env['AWS_REGION'];
	// then we can register our classes with the DI container
	diContainer.register({
		eventBridgeClient: asFunction(() => EventBridgeClientFactory.create(awsRegion), {
			...commonInjectionOptions,
		}),
	});
});

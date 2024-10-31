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

import fp from 'fastify-plugin';

import FastifySwagger, { FastifySwaggerOptions } from '@fastify/swagger';

import { writeFile } from 'fs';

export default fp<FastifySwaggerOptions>(async (app) => {
	await app.register(FastifySwagger, {
		openapi: {
			info: {
				title: 'AGIE Executor',
				description: `This API oversees the creation and monitoring of execution tasks specific to a particular region.`,
				version: '1.0.0',
			},
			servers: [
				{
					url: 'http://localhost:30001',
				},
			],
			tags: [
				{
					name: 'ExecutionTask',
					description:
						'ExecutionTask handles the processing of historical data within an AWS Region. It encapsulates the AWS Region to be processed, a specific time range in the past, and user-defined processing parameters. The task tracks the execution state and results of the historical data processing operation.',
				},
				{
					name: 'ExecutionTaskItem',
					description:
						'ExecutionTaskItem represents a discrete unit of work within an ExecutionTask. Each item is a sub-component that contributes to the overall execution process, maintaining its own state and progress while being managed by its parent ExecutionTask',
				},
			],
			security: [],
		},
	});

	if (process.env['NODE_ENV'] === 'local') {
		const specFile = './docs/swagger.json';

		app.ready((err) => {
			if (err) throw err;

			const apiSpec = JSON.stringify(app.swagger(), null, 2);

			writeFile(specFile, apiSpec, (err) => {
				if (err) {
					return app.log.error(`failed to save api spec to ${specFile} - err:${err}`);
				}
				app.log.debug(`saved api spec to ${specFile}`);
			});
		});
	}
});

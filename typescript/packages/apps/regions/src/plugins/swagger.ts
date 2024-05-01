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
				title: 'ARCADE Regions',
				description: `Manages hierarchical structures of groups, regions, and polygons.`,
				version: '1.0.0',
			},
			servers: [
				{
					url: 'http://localhost:30001',
				},
			],
			tags: [
				{
					name: 'Groups',
					description: 'Groups represent collections of Regions.',
				},
				{
					name: 'Regions',
					description: 'Regions represent collections of Polygons.',
				},
				{
					name: 'Polygons',
					description: 'Polygons represent a specific geographic location.',
				},
				{
					name: 'States',
					description: 'States represent the state of a specific polygon at a specific point in time.',
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

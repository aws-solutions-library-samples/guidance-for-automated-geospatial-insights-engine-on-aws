import FastifySwagger, { FastifySwaggerOptions } from '@fastify/swagger';
import fp from 'fastify-plugin';
import { writeFile } from 'fs';

export default fp<FastifySwaggerOptions>(async (app) => {
	await app.register(FastifySwagger, {
		openapi: {
			info: {
				title: 'arcade: Results module',
				description:
					'\nIs responsible for:\n- managing Stac Items in the Stac Server\n',
				version: '0.0.1',
			},
			servers: [
				{
					url: 'http://localhost',
				},
			],
			tags: [
				{
					name: 'Results',
					description: 'Results Module',
				},
			],

			security: [],
		}
	});

	if (process.env['NODE_ENV'] === 'local') {
		const specFile = './docs/swagger.json';

		app.ready(() => {
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

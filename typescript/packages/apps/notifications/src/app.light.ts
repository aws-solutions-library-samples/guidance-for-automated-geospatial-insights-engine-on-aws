import type { FastifyInstance } from 'fastify';
import { fastify } from 'fastify';
import awilix from './plugins/module.awilix.js';

export const buildLightApp = async (): Promise<FastifyInstance> => {
	// initialize fastify, using TypeBox as the type provider
	const environment = process.env['NODE_ENV'] as string;
	const logLevel = process.env['LOG_LEVEL'] as string;
	const envToLogger = {
		local: {
			level: logLevel ?? 'debug',
			transport: {
				target: 'pino-pretty',
				options: {
					translateTime: 'HH:MM:ss Z',
					ignore: 'pid,hostname',
				},
			},
		},
		prod: {
			level: logLevel ?? 'warn',
		},
	};
	const app = fastify({
		logger: envToLogger[environment] ?? {
			level: logLevel ?? 'info',
		},
	});
	// register ioc plugin
	await app.register(awilix);

	return app as unknown as FastifyInstance;
};

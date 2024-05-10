import type { AwilixContainer } from 'awilix';
import type { Callback, Context, Handler } from 'aws-lambda';
import type { FastifyInstance } from 'fastify';
import { buildLightApp } from './app.light.js';
import { StacServerInitializer } from './events/stacServerInitializer.js';
import ow from 'ow';

const app: FastifyInstance = await buildLightApp();
const di: AwilixContainer = app.diContainer;

const stacServerInitializer = di.resolve<StacServerInitializer>('stacServerInitializer');

export const handler: Handler = async (event, _context: Context, _callback: Callback) => {
	console.log(`StacServerInitializer > handler > event: ${JSON.stringify(event)}`);

	ow(event, ow.object.nonEmpty);
	ow(event['path'], ow.string.nonEmpty);
	const path = event['path' as string];

	try {
		/**
		 * Filter the create role request
		 */
		if ((path as string) === '/roles') {
			await stacServerInitializer.processCreateRole();
		} else if ((path as string) === '/users') {
			/**
			 * Filter the the user creation request
			 */
			await stacServerInitializer.processCreateUser(event['body'] as unknown as CreateUserEvent);
		} else if ((path as string) === '/users/roles') {
			/**
			 * Filter the user role linkage request
			 */
			await stacServerInitializer.processLineRoleToUser();
		} else {
			app.log.error(`StacServerInitializer > handler > Unimplemented event: ${JSON.stringify(event)}`);
		}
	} catch (error) {
		app.log.error(`StacServerInitializer > error: ${JSON.stringify(error)}`);
		return {
			statusCode: 500,
			body: JSON.stringify({
				message: error.message,
			}),
		};
	}

	app.log.info(`StacServerInitializer > handler >exit`);
	return {
		statusCode: 201,
	};
};

export interface CreateUserEvent {
	password: string;
}

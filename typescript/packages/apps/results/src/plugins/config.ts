import fastifyEnv, { FastifyEnvOptions } from '@fastify/env';
import { Static, Type } from '@sinclair/typebox';
import fp from 'fastify-plugin';
// @ts-ignore
import { baseConfigSchema, convertFromTypeBoxIntersectToJSONSchema } from '@arcade/resource-api-base';

// eslint-disable-next-line @rushstack/typedef-var
export const moduleConfigSchema = Type.Object({
	EVENT_BUS_NAME: Type.String(),
	PORT: Type.Number({ default: 30002 }),
	TABLE_NAME: Type.String(),
	LOG_LEVEL: Type.String({ default: 'info' }),
});
export const configSchema = Type.Intersect([moduleConfigSchema, baseConfigSchema]);

export type ConfigSchemaType = Static<typeof configSchema>;

export default fp<FastifyEnvOptions>(async (app): Promise<void> => {
	await app.register(fastifyEnv, {
		confKey: 'config',
		schema: convertFromTypeBoxIntersectToJSONSchema(configSchema),
		dotenv: true,
	});
	app.log.info(`config: ${JSON.stringify(app.config)}`);
});

declare module 'fastify' {
	interface FastifyInstance {
		config: ConfigSchemaType;
	}
}

import { FastifyBaseLogger } from "fastify";
import { createClient, createCluster, RedisClientType, SocketClosedUnexpectedlyError } from "redis";
import ow from 'ow';

let redisClient: RedisClient | undefined;

export type RedisClient = Pick<RedisClientType, 'on' | 'connect' | 'get' | 'set' | 'del' | 'isOpen'>

const LOCAL_HOST = '127.0.0.1'

export class CommonCache<T> {
	private readonly resourceType: string;

	public constructor(private readonly log: FastifyBaseLogger, resourceType: 'Region' | 'Polygon', private readonly redisEndpoint: string) {
		this.resourceType = resourceType.toLowerCase();
	}

	private async createRedisClient(): Promise<RedisClient> {
		this.log.debug(`CommonCache<${this.resourceType}> createRedisClient> in:`)
		const cluster = this.redisEndpoint === LOCAL_HOST ? createClient() : createCluster(
			{
				rootNodes: [
					{
						socket: {
							host: this.redisEndpoint,
							port: 6379
						}
					},
					{
						socket: {
							host: this.redisEndpoint,
							port: 6380
						}
					}
				],
				useReplicas: true,
				defaults: {
					socket: {
						tls: true
					}
				}
			}
		);
		cluster.on("error", (e) => this.log.error(`CommonCache<${this.resourceType}> createRedisClient> error: ${e}`))
		await cluster.connect();
		this.log.debug(`CommonCache<${this.resourceType}> createRedisClient> exit:`)
		return cluster as unknown as RedisClient;
	}

	private async getRedisClient(nthTry: number = 1): Promise<RedisClient> {
		this.log.debug(`CommonCache<${this.resourceType}> getRedisClient> in: nthTry: ${nthTry}`)
		try {
			if (!redisClient) {
				redisClient = await this.createRedisClient()
			}

			this.log.debug(`CommonCache<${this.resourceType}> getRedisClient> exit:`)

			if (!redisClient.isOpen) {
				throw new Error(`CommonCache<${this.resourceType}> getRedisClient> error: connection to cluster is not open`)
			}
			return redisClient;
		} catch (error) {
			this.log.debug(`CommonCache<${this.resourceType}> getRedisClient> error: ${JSON.stringify(error)}`)
			if (error instanceof SocketClosedUnexpectedlyError && nthTry > 0) {
				redisClient = null;
				return this.getRedisClient(nthTry - 1);
			}
			throw error;
		}
	}

	public async delete(resourceId: string): Promise<void> {
		this.log.info(`CommonCache<${this.resourceType}>> delete> in: resourceId: ${resourceId}`)
		ow(resourceId, ow.string.nonEmpty);

		const key = `${this.resourceType}:${resourceId};`
		const client = await this.getRedisClient();
		await client.del(key);

		this.log.info(`CommonCache<${this.resourceType}>> delete> exit:`)
	}

	public async get(resourceId: string): Promise<T | undefined> {
		this.log.info(`CommonCache<${this.resourceType}>> get> in: resourceId: ${resourceId}`)
		ow(resourceId, ow.string.nonEmpty);

		const key = `${this.resourceType}:${resourceId};`

		const client = await this.getRedisClient();
		const cachedResource = await client.get(key);

		if (!cachedResource) return undefined;
		this.log.info(`CommonCache<${this.resourceType}>> get> exit: cachedResource: ${cachedResource}`)
		return JSON.parse(cachedResource);
	}

	public async set(resourceId: string, resource: T): Promise<void> {
		this.log.info(`CommonCache<${this.resourceType}>> get> in: resourceId: ${resourceId}`)
		ow(resourceId, ow.string.nonEmpty);
		ow(resource, ow.object.nonEmpty)

		const key = `${this.resourceType}:${resourceId};`

		const client = await this.getRedisClient();
		await client.set(key, JSON.stringify(resource));

		this.log.info(`CommonCache<${this.resourceType}>> set> exit:`)
	}
}

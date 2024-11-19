import { createDelimitedAttribute, expandDelimitedAttribute } from '@agie/dynamodb-utils';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { PkType } from '../../common/pkUtils.js';
import { NextToken } from '../../common/schemas.js';
import { RegistrationListOptions, RegistrationResource } from './schemas.js';

export class RegistrationRepository {
	public constructor(private readonly log: FastifyBaseLogger, private readonly dc: DynamoDBDocumentClient, private readonly tableName: string) {}

	public assemble(item: Record<string, any>): RegistrationResource {
		this.log.debug(`RegistrationRepository> assemble> in> item: ${JSON.stringify(item)}`);
		if (item === undefined) {
			return undefined;
		}
		return {
			engineId: item.engineId,
			regionId: item.regionId,
			createdAt: item.createdAt,
		};
	}

	public async get(engineId: string, regionId: string): Promise<RegistrationResource> {
		this.log.debug(`RegistrationRepository> get> in> engineId: ${engineId}, regionId: ${regionId}`);

		const engineDbId = createDelimitedAttribute(PkType.Engine, engineId);
		const regionDbId = createDelimitedAttribute(PkType.Region, regionId);

		const response = await this.dc.send(
			new GetCommand({
				TableName: this.tableName,
				Key: {
					pk: engineDbId,
					sk: regionDbId,
				},
			})
		);

		if (!response.Item) return undefined;

		return this.assemble(response.Item);
	}

	public async list(engineId: string, options?: RegistrationListOptions): Promise<[RegistrationResource[], NextToken]> {
		this.log.debug(`RegistrationRepository> list> in> engineId:${engineId}, options: ${JSON.stringify(options)}`);

		const lastEvaluatedKey = options?.token
			? {
					pk: createDelimitedAttribute(PkType.Engine, engineId),
					sk: createDelimitedAttribute(PkType.Region, options.token),
			  }
			: undefined;

		const queryCommandInput: QueryCommandInput = {
			TableName: this.tableName,
			KeyConditionExpression: 'pk = :pk AND begins_with(sk,:sk)',
			ExpressionAttributeValues: {
				':pk': createDelimitedAttribute(PkType.Engine, engineId),
				':sk': createDelimitedAttribute(PkType.Region),
			},
			ExclusiveStartKey: lastEvaluatedKey,
			Limit: options?.count as number,
		};

		try {
			const queryResponse = await this.dc.send(new QueryCommand(queryCommandInput));

			const items = queryResponse.Items?.map((item) => this.assemble(item)) || [];

			let lastEvaluatedRegionId: string;
			if (queryResponse.LastEvaluatedKey) {
				lastEvaluatedRegionId = expandDelimitedAttribute(queryResponse.LastEvaluatedKey['sk'])[1];
			}

			this.log.debug(`RegistrationRepository> list> exit> items: ${JSON.stringify(items)}`);
			return [items, lastEvaluatedRegionId];
		} catch (error) {
			this.log.error({ error }, 'Error listing items from DynamoDB');
			throw error;
		}
	}

	public async delete(engineId: string, regionId: string): Promise<void> {
		this.log.debug(`RegistrationRepository> delete> in> engineId: ${engineId}, regionId: ${regionId}`);

		const engineDbId = createDelimitedAttribute(PkType.Engine, engineId);
		const regionDbId = createDelimitedAttribute(PkType.Region, regionId);

		try {
			await this.dc.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: {
						pk: engineDbId,
						sk: regionDbId,
					},
				})
			);
		} catch (error) {
			this.log.error({ error }, 'Error deleting item from DynamoDB');
			throw error;
		}

		this.log.debug(`RegistrationRepository> delete> exit>`);
	}

	public async create(registrationResource: RegistrationResource): Promise<void> {
		this.log.debug(`RegistrationRepository> create> in> item: ${JSON.stringify(registrationResource)}`);

		const engineDbId = createDelimitedAttribute(PkType.Engine, registrationResource.engineId);
		const regionDbId = createDelimitedAttribute(PkType.Region, registrationResource.regionId);

		try {
			await this.dc.send(
				new PutCommand({
					TableName: this.tableName,
					Item: {
						pk: engineDbId,
						sk: regionDbId,
						...registrationResource,
					},
				})
			);
		} catch (error) {
			this.log.error({ error }, 'Error creating item in DynamoDB');
			throw error;
		}

		this.log.debug(`RegistrationRepository> create> exit>`);
	}
}

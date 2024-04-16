import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { createDelimitedAttribute } from '../../common/ddbAttributes.util.js';
import { PkType } from '../../common/pkTypes.js';
import { Tags } from '../../common/schemas.js';
import { CommonRepository, DynamoDBItems } from '../repository.common.js';
import { Group } from './schemas.js';

export class GroupRepository {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly dc: DynamoDBDocumentClient,
		public readonly tableName: string,
		readonly dynamoDbUtils: DynamoDbUtils,
		readonly commonRepository: CommonRepository
	) {}

	public async create(g: Group): Promise<void> {
		this.log.debug(`GroupRepository> create> c:${JSON.stringify(g)}`);

		// the main item
		const transaction = this.prepareGroupTransactionWrite(g);
		const groupDbId = createDelimitedAttribute(PkType.Group, g.id);

		// add any tags
		this.commonRepository.addTags(g.tags, groupDbId, transaction);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`GroupRepository> create> exit>`);
	}

	public async update(g: Group, tagsToAdd: Tags, tagsToDelete: string[]): Promise<void> {
		this.log.debug(`GroupRepository> update> g:${JSON.stringify(g)}, tagsToAdd:${JSON.stringify(tagsToAdd)}, tagsToDelete:${JSON.stringify(tagsToDelete)}`);

		// the main item
		const transaction = this.prepareGroupTransactionWrite(g);

		// add/delete tag items
		transaction.TransactItems.push(...this.commonRepository.prepareTagTransactionWrite(g.id, PkType.Group, tagsToAdd, tagsToDelete).TransactItems);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`GroupRepository> update> exit>`);
	}

	private prepareGroupTransactionWrite(g: Group): TransactWriteCommandInput {
		const groupDbId = createDelimitedAttribute(PkType.Group, g.id);
		const command: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: groupDbId,
							sk: groupDbId,
							type: PkType.Group,
							id: g.id,
							name: g.name,
							attributes: g.attributes,
							createdAt: g.createdAt,
							createdBy: g.createdBy,
							updatedAt: g.updatedAt,
							updatedBy: g.updatedBy,
						},
					},
				},
			],
		};
		return command;
	}

	public async delete(id: string): Promise<void> {
		this.log.debug(`GroupRepository> delete> id:${id}`);
		const transaction = await this.commonRepository.prepareDeleteItemsTransaction(PkType.Group, id);
		await this.commonRepository.executeTransaction(transaction);
		this.log.debug(`GroupRepository> delete> exit>`);
	}

	public async get(id: string): Promise<Group | undefined> {
		this.log.debug(`GroupRepository> get> id:${JSON.stringify(id)}`);

		const items = await this.commonRepository.getItems(PkType.Group, id);
		const group = this.assembleGroup(items);
		this.log.debug(`GroupRepository> get> exit:${JSON.stringify(group)}`);
		return group;
	}

	public async listByIds(groupIds: string[]): Promise<Group[]> {
		this.log.debug(`GroupRepository> listByIds> groupIds:${JSON.stringify(groupIds)}`);
		const items = await this.commonRepository.listItemsByIds(PkType.Group, groupIds);
		const groups = this.assembleGroups(items);
		this.log.debug(`GroupRepository> listByIds> exit:${JSON.stringify([groups])}`);
		return groups;
	}

	private assembleGroups(items: DynamoDBItems): Group[] {
		const groups: Group[] = [];
		const groupIds = new Set(items.map((i) => i.pk));
		for (const groupId of groupIds) {
			const groupItems = items.filter((i) => i.pk === groupId);
			const group = this.assembleGroup(groupItems);
			groups.push(group);
		}
		return groups;
	}

	private assembleGroup(items: DynamoDBItems): Group {
		this.log.debug(`GroupRepository> assemble> in> items:${JSON.stringify(items)}`);
		if ((items?.length ?? 0) === 0) {
			return undefined;
		}

		// build the main group resource
		const groupItem = items.filter((i) => i.type === PkType.Group)[0];
		const group: Group = {
			id: groupItem.id,
			name: groupItem.name,
			attributes: groupItem.attributes,
			tags: {},
			createdBy: groupItem.createdBy,
			createdAt: groupItem.createdAt,
			updatedBy: groupItem.updatedBy,
			updatedAt: groupItem.updatedAt,
		};

		this.commonRepository.assembleTags(items, group.tags);

		this.log.debug(`GroupRepository> assemble> exit:${JSON.stringify(group)}`);
		return group;
	}
}

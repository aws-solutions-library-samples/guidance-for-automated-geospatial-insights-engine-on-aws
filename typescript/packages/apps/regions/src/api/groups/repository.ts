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

import { DynamoDbUtils } from '@arcade/dynamodb-utils';
import {
	DynamoDBDocumentClient,
	TransactWriteCommandInput,
	UpdateCommand,
	UpdateCommandInput
} from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { createDelimitedAttribute } from '../../common/ddbAttributes.util.js';
import { PkType } from '../../common/pkTypes.js';
import { Tags } from '../../common/schemas.js';
import { CommonRepository, DynamoDBItems } from '../repository.common.js';
import { Group, UpdateAggregatedRegionsParameter } from './schemas.js';

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
							totalArea: g.totalArea,
							totalRegions: g.totalRegions
						},
					},
				},
			],
		};
		return command;
	}

	public async updateAggregatedAttribute(id: string, aggregatedAttribute: UpdateAggregatedRegionsParameter): Promise<Group> {
		this.log.debug(`RegionRepository> updateAggregatedAttribute> id: ${id}, aggregatedAttribute: ${JSON.stringify(aggregatedAttribute)}`);
		const groupDbId = createDelimitedAttribute(PkType.Group, id);
		const params: UpdateCommandInput = {
			UpdateExpression: "SET totalArea = totalArea + :totalAreaDelta, totalRegions = totalRegions + :totalRegionsDelta",
			ExpressionAttributeValues: {
				':totalAreaDelta': aggregatedAttribute.totalAreaDelta,
				':totalRegionsDelta': aggregatedAttribute.totalRegionsDelta
			},
			Key: {
				pk: groupDbId,
				sk: groupDbId
			},
			TableName: this.tableName,
			ReturnValues: "ALL_NEW"
		}
		const updateResponse = await this.dc.send(new UpdateCommand(params));
		const group = this.assembleGroup([updateResponse.Attributes])
		this.log.debug(`RegionRepository> updateAggregatedAttribute> group: ${JSON.stringify(group)}`);
		return group;
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
			totalArea: groupItem.totalArea,
			totalRegions: groupItem.totalRegions
		};

		this.commonRepository.assembleTags(items, group.tags);

		this.log.debug(`GroupRepository> assemble> exit:${JSON.stringify(group)}`);
		return group;
	}
}

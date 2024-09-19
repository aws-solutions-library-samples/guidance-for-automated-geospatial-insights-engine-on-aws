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

import { DynamoDbUtils } from '@agie/dynamodb-utils';
import { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { FastifyBaseLogger } from 'fastify';
import { createDelimitedAttribute } from '../../common/ddbAttributes.util.js';
import { PkType } from '../../common/pkTypes.js';
import { Tags } from '../../common/schemas.js';
import { CommonRepository, DynamoDBItems } from '../repository.common.js';
import { StateRepository } from '../states/repository.js';
import { Polygon } from './schemas.js';

export class PolygonRepository {
	public constructor(
		readonly log: FastifyBaseLogger,
		readonly dc: DynamoDBDocumentClient,
		readonly tableName: string,
		readonly dynamoDbUtils: DynamoDbUtils,
		readonly commonRepository: CommonRepository,
		readonly stateRepository: StateRepository
	) {}

	public async create(polygon: Polygon): Promise<void> {
		this.log.debug(`PolygonRepository> create> c:${JSON.stringify(polygon)}`);

		// the main item
		const transaction = this.preparePolygonTransactionWrite(polygon);

		// add any tags
		const polygonDbId = createDelimitedAttribute(PkType.Polygon, polygon.id);
		this.commonRepository.addTags(polygon.tags, polygonDbId, transaction);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`PolygonRepository> create> exit>`);
	}

	public async update(z: Polygon, tagsToAdd: Tags, tagsToDelete: string[]): Promise<void> {
		this.log.debug(`PolygonRepository> update> z:${JSON.stringify(z)}, tagsToAdd:${JSON.stringify(tagsToAdd)}, tagsToDelete:${JSON.stringify(tagsToDelete)}`);

		// the main item
		const transaction = this.preparePolygonTransactionWrite(z);

		// add/delete tag items
		transaction.TransactItems.push(...this.commonRepository.prepareTagTransactionWrite(z.id, PkType.Polygon, tagsToAdd, tagsToDelete).TransactItems);

		await this.commonRepository.executeTransaction(transaction);

		this.log.debug(`PolygonRepository> update> exit>`);
	}

	private preparePolygonTransactionWrite(z: Polygon): TransactWriteCommandInput {
		const polygonDbId = createDelimitedAttribute(PkType.Polygon, z.id);
		const command: TransactWriteCommandInput = {
			TransactItems: [
				{
					Put: {
						TableName: this.tableName,
						Item: {
							pk: polygonDbId,
							sk: polygonDbId,
							type: PkType.Polygon,
							id: z.id,
							name: z.name,
							regionId: z.regionId,
							groupId: z.groupId,
							boundary: z.boundary,
							exclusions: z.exclusions,
							area: z.area,
							attributes: z.attributes,
							createdAt: z.createdAt,
							createdBy: z.createdBy,
							updatedAt: z.updatedAt,
							updatedBy: z.updatedBy,
						},
					},
				},
			],
		};
		return command;
	}

	public async get(id: string): Promise<Polygon | undefined> {
		this.log.debug(`PolygonRepository> get> id:${JSON.stringify(id)}`);

		const items = await this.commonRepository.getItems(PkType.Polygon, id);
		const polygon = await this.assemblePolygon(items, true);
		this.log.debug(`PolygonRepository> get> exit:${JSON.stringify(polygon)}`);
		return polygon;
	}

	public async delete(id: string): Promise<void> {
		this.log.debug(`PolygonRepository> delete> id:${id}`);
		const transaction = await this.commonRepository.prepareDeleteItemsTransaction(PkType.Polygon, id);
		await this.commonRepository.executeTransaction(transaction);
		this.log.debug(`GroupRepository> delete> exit>`);
	}

	public async listByIds(polygonIds: string[], includeLatestState: boolean): Promise<Polygon[]> {
		this.log.debug(`PolygonRepository> listByIds> polygonIds:${JSON.stringify(polygonIds)}, includeLatestState:${includeLatestState}`);
		const items = await this.commonRepository.listItemsByIds(PkType.Polygon, polygonIds);
		const polygons = await this.assemblePolygons(items, includeLatestState);
		this.log.debug(`PolygonRepository> listByIds> exit:${JSON.stringify([polygons])}`);
		return polygons;
	}

	private async assemblePolygons(items: DynamoDBItems, includeLatestState: boolean): Promise<Polygon[]> {
		this.log.debug(`PolygonRepository> assemblePolygons> in> items:${JSON.stringify(items)}, includeLatestState:${includeLatestState}`);
		const polygons: Polygon[] = [];
		const polygonIds = new Set(items.map((i) => i.pk));
		for (const polygonId of polygonIds) {
			const polygonItems = items.filter((i) => i.pk === polygonId);
			const polygon = await this.assemblePolygon(polygonItems, includeLatestState);
			if (polygon) {
				polygons.push(polygon);
			}
		}
		return polygons;
	}

	private async assemblePolygon(items: DynamoDBItems, includeLatestState: boolean): Promise<Polygon> {
		this.log.debug(`PolygonRepository> assemble> in> items:${JSON.stringify(items)}, includeLatestState:${includeLatestState}`);
		if ((items?.length ?? 0) === 0) {
			return undefined;
		}

		// build the main polygon resource
		let polygon: Polygon;
		const polygonItem = items.filter((i) => i.type === PkType.Polygon)[0];
		if (polygonItem) {
			polygon = {
				id: polygonItem.id,
				regionId: polygonItem.regionId,
				groupId: polygonItem.groupId,
				name: polygonItem.name,
				boundary: polygonItem.boundary,
				exclusions: polygonItem.exclusions,
				area: polygonItem.area,
				attributes: polygonItem.attributes,
				tags: {},
				createdBy: polygonItem.createdBy,
				createdAt: polygonItem.createdAt,
				updatedBy: polygonItem.updatedBy,
				updatedAt: polygonItem.updatedAt,
			};

			// assemble latest state
			if (includeLatestState === true) {
				const latestStateItem = items.filter((i) => i.type === PkType.LatestState)?.[0];
				if (latestStateItem) {
					const stateId = latestStateItem.id;
					polygon.state = await this.stateRepository.get(stateId);
				}
			}

			this.commonRepository.assembleTags(items, polygon.tags);
		}

		this.log.debug(`PolygonRepository> assemble> exit:${JSON.stringify(polygon)}`);
		return polygon;
	}
}

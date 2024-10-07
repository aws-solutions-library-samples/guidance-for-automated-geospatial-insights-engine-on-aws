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

import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { PkType } from '../common/pkTypes.js';
import { Tags } from '../common/schemas.js';
import { TagUtils } from '../tags/tags.util.js';
import { CreateGroup, EditGroup, Group } from './groups/schemas.js';
import { CommonRepository } from './repository.common.js';
import { CommonService, TagFilterOptions } from './service.common.js';

describe('CommonService', () => {
	let commonRepository: MockProxy<CommonRepository>;

	let tagUtils: TagUtils; // intentionally using real
	let underTest: CommonService;

	beforeEach(() => {
		const logger = pino.default(
			pino.destination({
				sync: true, // test frameworks must use pino logger in sync mode!
			})
		);
		logger.level = 'info';
		commonRepository = mock<CommonRepository>();
		tagUtils = new TagUtils(logger);
		underTest = new CommonService(logger, commonRepository, tagUtils);
	});

	it('prepareResourceForCreate happy path', async () => {
		const resource: CreateGroup = {
			name: 'group 1',
			attributes: {
				attr1: 'attr-one',
				attr2: 'attr-two',
			},
			tags: {
				tag1: 'tag-one',
				tag2: 'tag-two',
			},
		};
		const reservedAsTags = ['name'];
		const additional = {
			attributes: {
				attr2: 'attr-two-again',
				attr3: 'attr-three',
			},
		};
		const additionalTags: Tags = {
			tag2: 'tag-two-again',
			tag3: 'tag-three',
		};

		const result = underTest.prepareResourceForCreate(resource, reservedAsTags, additional, additionalTags);

		expect(result).toEqual({
			id: expect.any(String),
			createdAt: expect.any(String),
			name: resource.name,
			attributes: {
				attr1: 'attr-one',
				attr2: 'attr-two-again',
				attr3: 'attr-three',
			},
			tags: {
				tag1: 'tag-one',
				tag2: 'tag-two-again',
				tag3: 'tag-three',
				___name: resource.name,
			},
		});
	});

	it('prepareResourceForUpdate happy path', async () => {
		const existing: Group = {
			id: 'some-id',
			name: 'group 1',
			totalArea: 100,
			totalRegions: 2,
			attributes: {
				attr1: 'attr-one',
				attr2: 'attr-two',
				attr3: 'attr-three',
			},
			tags: {
				tag1: 'tag-one',
				tag2: 'tag-two',
				tag3: 'tag-three',
			},
			createdAt: '2024-05-23',
			createdBy: 'someone@somewhere.com',
		};
		const updated: EditGroup = {
			name: 'group 1 - changed',
			attributes: {
				attr2: 'attr-two-changed',
				attr3: null,
			},
			tags: {
				tag2: 'tag-two-changed',
				tag3: null,
			},
		};
		const reservedAsTags = ['name'];
		const updatedBy = 'someoneelse@somewhere.com';

		const [merged, tagDiff] = underTest.prepareResourceForUpdate(existing, updated, reservedAsTags, updatedBy);

		expect(merged).toEqual({
			id: existing.id,
			name: updated.name,
			totalArea: 100,
			totalRegions: 2,
			attributes: {
				attr1: 'attr-one',
				attr2: 'attr-two-changed',
			},
			createdAt: existing.createdAt,
			createdBy: existing.createdBy,
			updatedAt: expect.any(String),
			updatedBy,
		});
		expect(tagDiff).toEqual({
			toDelete: ['tag3'],
			toPut: {
				tag2: 'tag-two-changed',
				___name: updated.name,
			},
		});
	});

	it('listIds happy path', async () => {
		const keyPrefix = PkType.Group;
		const options: TagFilterOptions = {
			count: 5,
			tags: {
				tag1: 'tag-one',
				tag2: 'tag-two',
			},
		};

		// mocks
		commonRepository.listResourceIdsByTag
			.mockResolvedValueOnce([['01', '02', '04', '05', '07'], '07']) // tag filter 1 - page 1
			.mockResolvedValueOnce([['02', '03', '05', '06', '08'], '08']) // tag filter 2 - page 1
			.mockResolvedValueOnce([['08', '10', '11', '13', '14'], '14']) // tag filter 1 - page 2
			.mockResolvedValueOnce([['09', '11', '12', '14', '15'], '15']); // tag filter 2 - page 2

		// execute
		const actual = await underTest.listResourceIdsByTag(keyPrefix, options);
		const expected = [['02', '05', '08', '11', '14'], '14'];

		// verify
		expect(actual).toStrictEqual(expected);

		expect(commonRepository.listResourceIdsByTag).toHaveBeenCalledWith('tag1', 'tag-one', keyPrefix, {
			count: 5,
			token: undefined,
		});

		expect(commonRepository.listResourceIdsByTag).toHaveBeenCalledWith('tag2', 'tag-two', keyPrefix, {
			count: 5,
			token: undefined,
		});

		expect(commonRepository.listResourceIdsByTag).toHaveBeenCalledWith('tag1', 'tag-one', keyPrefix, {
			count: 5,
			token: '07',
		});

		expect(commonRepository.listResourceIdsByTag).toHaveBeenCalledWith('tag2', 'tag-two', keyPrefix, {
			count: 5,
			token: '08',
		});
	});
});

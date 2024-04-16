import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, groupId, paginationToken, tags, updatedAt, updatedBy } from '../../common/schemas.js';

/**
 * Group specific path parameters
 */

/**
 * Group specific query string parameters
 */

/**
 * Group specific resource parameters
 */
const name = Type.String({ description: 'The name of the Group.' });

/**
 * Group specific resources
 */

export const createGroupRequestBody = Type.Object(
	{
		name,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createGroupRequestBody' }
);
export type CreateGroup = Static<typeof createGroupRequestBody>;

export const editGroupRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editGroupRequestBody' }
);
export type EditGroup = Static<typeof editGroupRequestBody>;

export const groupResource = Type.Object(
	{
		id: groupId,
		name,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
		createdBy: createdBy,
		createdAt: createdAt,
		updatedBy: Type.Optional(updatedBy),
		updatedAt: Type.Optional(updatedAt),
	},
	{ $id: 'groupResource' }
);
export type Group = Static<typeof groupResource>;

export const groupList = Type.Object(
	{
		groups: Type.Array(Type.Ref(groupResource)),
		pagination: Type.Optional(
			Type.Object({
				token: Type.Optional(paginationToken),
				count: Type.Optional(Type.Number()),
			})
		),
	},
	{ $id: 'groupList' }
);
export type GroupList = Static<typeof groupList>;

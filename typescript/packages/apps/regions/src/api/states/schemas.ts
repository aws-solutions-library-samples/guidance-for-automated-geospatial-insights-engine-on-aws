import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, groupId, paginationToken, regionId, stateId, tags, updatedAt, updatedBy, polygonId } from '../../common/schemas.js';

/**
 * State specific path parameters
 */

/**
 * State specific query string parameters
 */
export const latestStateOnlyQS = Type.Optional(Type.Boolean({ description: 'Returns latest state only.', default: true }));

/**
 * State specific resource parameters
 */
export const timestamp = Type.String({
	description: 'Date/time created',
	format: 'date-time',
});

/**
 * State specific resources
 */

export const createStateRequestBody = Type.Object(
	{
		timestamp,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createStateRequestBody' }
);
export type CreateState = Static<typeof createStateRequestBody>;

export const editStateRequestBody = Type.Object(
	{
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editStateRequestBody' }
);
export type EditState = Static<typeof editStateRequestBody>;

export const stateResource = Type.Object(
	{
		id: stateId,
		polygonId,
		regionId,
		groupId,
		timestamp,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
		createdBy: createdBy,
		createdAt: createdAt,
		updatedBy: Type.Optional(updatedBy),
		updatedAt: Type.Optional(updatedAt),
	},
	{ $id: 'stateResource' }
);
export type State = Static<typeof stateResource>;

export const stateList = Type.Object(
	{
		states: Type.Array(Type.Ref(stateResource)),
		pagination: Type.Optional(
			Type.Object({
				token: Type.Optional(paginationToken),
				count: Type.Number(),
			})
		),
	},
	{ $id: 'stateList' }
);
export type StateList = Static<typeof stateList>;

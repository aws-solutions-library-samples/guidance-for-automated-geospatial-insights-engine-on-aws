import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, regionId, paginationToken, tags, updatedAt, updatedBy } from '../../common/schemas.js';

/**
 * Region specific path parameters
 */

/**
 * Region specific query string parameters
 */

/**
 * Region specific resource parameters
 */
export const name = Type.String({ description: 'The name of the Region.' });


/**
 * Region specific resources
 */

export const createRegionRequestBody = Type.Object(
	{
		name,
		attributes: Type.Optional(attributes),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createRegionRequestBody' }
);
export type CreateRegion = Static<typeof createRegionRequestBody>;

export const editRegionRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		attributes: Type.Optional(attributes),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editRegionRequestBody' }
);
export type EditRegion = Static<typeof editRegionRequestBody>;

export const regionResource = Type.Object(
	{
		id: regionId,
		name,
		attributes: Type.Optional(attributes),
		tags: Type.Optional(Type.Ref(tags)),
		createdBy: createdBy,
		createdAt: createdAt,
		updatedBy: Type.Optional(updatedBy),
		updatedAt: Type.Optional(updatedAt),
	},
	{ $id: 'regionResource' }
);
export type Region = Static<typeof regionResource>;

export const regionList = Type.Object(
	{
		regions: Type.Array(Type.Ref(regionResource)),
		pagination: Type.Optional(
			Type.Object({
				lastEvaluatedToken: Type.Optional(paginationToken),
			})
		),
	},
	{ $id: 'regionList' }
);
export type RegionList = Static<typeof regionList>;

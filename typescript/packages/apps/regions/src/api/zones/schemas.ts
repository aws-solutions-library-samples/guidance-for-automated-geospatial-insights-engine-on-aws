import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, zoneId, paginationToken, tags, updatedAt, updatedBy } from '../../common/schemas.js';

/**
 * Zone specific path parameters
 */

/**
 * Zone specific query string parameters
 */

/**
 * Zone specific resource parameters
 */
export const name = Type.String({ description: 'The name of the Zone.' });
export const acres = Type.Number({ description: 'The areas of the Zone.' });
export const boundary = Type.Array(
	Type.Object({
		lat: Type.Number({description: 'Latitude'}),
		lon: Type.Number({description: 'Longitude'}),
	}, {description: 'Coordinates'}),
	{description: 'Coordinates of the boundary (polygon) of the Zone.'}
);



/**
 * Zone specific resources
 */

export const createZoneRequestBody = Type.Object(
	{
		name,
		boundary,
		attributes: Type.Optional(attributes),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createZoneRequestBody' }
);
export type CreateZone = Static<typeof createZoneRequestBody>;

export const editZoneRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		boundary: Type.Optional(boundary),
		attributes: Type.Optional(attributes),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editZoneRequestBody' }
);
export type EditZone = Static<typeof editZoneRequestBody>;

export const zoneResource = Type.Object(
	{
		id: zoneId,
		name,
		boundary,
		acres,
		attributes: Type.Optional(attributes),
		tags: Type.Optional(Type.Ref(tags)),
		createdBy: createdBy,
		createdAt: createdAt,
		updatedBy: Type.Optional(updatedBy),
		updatedAt: Type.Optional(updatedAt),
	},
	{ $id: 'zoneResource' }
);
export type Zone = Static<typeof zoneResource>;

export const zoneList = Type.Object(
	{
		zones: Type.Array(Type.Ref(zoneResource)),
		pagination: Type.Optional(
			Type.Object({
				lastEvaluatedToken: Type.Optional(paginationToken),
			})
		),
	},
	{ $id: 'zoneList' }
);
export type ZoneList = Static<typeof zoneList>;

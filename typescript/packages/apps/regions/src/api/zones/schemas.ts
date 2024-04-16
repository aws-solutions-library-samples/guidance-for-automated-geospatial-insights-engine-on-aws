import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, paginationToken, regionId, tags, updatedAt, updatedBy, zoneId } from '../../common/schemas.js';
import { stateResource } from '../states/schemas.js';

/**
 * Zone specific path parameters
 */

/**
 * Zone specific query string parameters
 */
export const includeLatestStateQS = Type.Optional(Type.Boolean({ description: 'Include latest state in results.', default: false }));

/**
 * Zone specific resource parameters
 */
const name = Type.String({ description: 'The name of the Zone.' });
const area = Type.Number({ description: 'The area of the Zone.' });
export const polygon = Type.Array(Type.Array(Type.Number({ description: 'Latitude' }), Type.Number({ description: 'Longitude' })), {
	$id: 'polygon',
	description: 'Coordinates defining a polygon.',
});
export type Polygon = Static<typeof polygon>;

const boundary = Type.Ref(polygon, { description: 'The boundary of the Zone.' });
const exclusions = Type.Array(Type.Ref(polygon), { description: 'Boundaries to be excluded from the Zone.' });

/**
 * Zone specific resources
 */

export const createZoneRequestBody = Type.Object(
	{
		name,
		boundary,
		exclusions: Type.Optional(exclusions),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createZoneRequestBody' }
);
export type CreateZone = Static<typeof createZoneRequestBody>;

export const editZoneRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		boundary: Type.Optional(boundary),
		exclusions: Type.Optional(exclusions),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editZoneRequestBody' }
);
export type EditZone = Static<typeof editZoneRequestBody>;

export const zoneResource = Type.Object(
	{
		id: zoneId,
		name,
		regionId,
		boundary,
		exclusions: Type.Optional(exclusions),
		area,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
		state: Type.Optional(Type.Ref(stateResource)),
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
				token: Type.Optional(paginationToken),
				count: Type.Number(),
			})
		),
	},
	{ $id: 'zoneList' }
);
export type ZoneList = Static<typeof zoneList>;

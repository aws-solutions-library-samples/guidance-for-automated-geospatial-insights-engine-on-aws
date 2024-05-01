import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, groupId, paginationToken, regionId, tags, updatedAt, updatedBy, zoneId } from '../../common/schemas.js';
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

const scheduleExpressionTimezone = Type.String({ description: 'The timezone in which the scheduling expression is evaluated.' });
const scheduleExpression = Type.String({
	description:
		'The expression that defines when the schedule runs. The following formats are supported.\n' +
		'\n' +
		'    at expression - at(yyyy-mm-ddThh:mm:ss)\n' +
		'\n' +
		'    rate expression - rate(value unit)\n' +
		'\n' +
		'    cron expression - cron(fields)\n' +
		'\n' +
		'You can use at expressions to create one-time schedules that invoke a target once, at the time and in the time zone, that you specify. You can use rate and cron expressions to create recurring schedules. Rate-based schedules are useful when you want to invoke a target at regular intervals, such as every 15 minutes or every five days. Cron-based schedules are useful when you want to invoke a target periodically at a specific time, such as at 8:00 am (UTC+0) every 1st day of the month.\n' +
		'\n' +
		'A cron expression consists of six fields separated by white spaces: (minutes hours day_of_month month day_of_week year).\n' +
		'\n' +
		'A rate expression consists of a value as a positive integer, and a unit with the following options: minute | minutes | hour | hours | day | days ',
});

/**
 * Zone specific resources
 */

export const createZoneRequestBody = Type.Object(
	{
		name,
		boundary,
		exclusions: Type.Optional(exclusions),
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
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
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
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
		groupId,
		boundary,
		exclusions: Type.Optional(exclusions),
		area,
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
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

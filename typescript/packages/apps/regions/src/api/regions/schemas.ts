import { Static, Type } from '@sinclair/typebox';
import {
	attributes,
	createdAt,
	createdBy,
	groupId,
	paginationToken,
	regionId,
	tags,
	updatedAt,
	updatedBy
} from '../../common/schemas.js';

/**
 * Region specific path parameters
 */

/**
 * Region specific query string parameters
 */

/**
 * Region specific resource parameters
 */
const name = Type.String({ description: 'The name of the Region.' });

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
const totalArea = Type.Number({ description: 'The total area covered by all polygons under this region.' });

const totalPolygons = Type.Number({ description: 'The total number of polygons under this region.' });
/**
 * Region specific resources
 */

export const createRegionRequestBody = Type.Object(
	{
		name,
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createRegionRequestBody' }
);
export type CreateRegion = Static<typeof createRegionRequestBody>;

export const editRegionRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editRegionRequestBody' }
);
export type EditRegion = Static<typeof editRegionRequestBody>;

export type UpdateAggregatedPolygonsParameter = {
	totalAreaDelta: number
	totalPolygonsDelta: number;
}

export const regionResource = Type.Object(
	{
		id: regionId,
		groupId,
		name,
		totalArea,
		totalPolygons,
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
		attributes: Type.Optional(Type.Ref(attributes)),
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
				token: Type.Optional(paginationToken),
				count: Type.Number(),
			})
		),
	},
	{ $id: 'regionList' }
);
export type RegionList = Static<typeof regionList>;

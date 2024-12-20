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

import { Static, Type } from '@sinclair/typebox';
import { attributes, createdAt, createdBy, groupId, paginationToken, regionId, tags, updatedAt, updatedBy } from '../../common/schemas.js';

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

const processingMode = Type.Enum(
	{
		scheduled: 'scheduled',
		disabled: 'disabled',
		onNewScene: 'onNewScene',
	},
	{
		description: 'The region processing mode.',
		default: 'disabled',
	}
);

const processingPriority = Type.Enum(
	{
		low: 'low',
		standard: 'standard',
		high: 'high',
	},
	{
		description: `The region processing priority, required for mode is set to 'scheduled' or 'onNewScene'`,
		default: 'standard',
	}
);

const scheduleExpressionTimezone = Type.String({ description: 'The timezone in which the scheduling expression is evaluated.' });

const scheduleExpression = Type.String({
	description:
		'The expression that defines when the schedule runs, required when mode is set to scheduled. The following formats are supported.\n' +
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

const engineId = Type.String({ description: 'Identifier of engine used to process the region.' });

const processingConfig = Type.Object(
	{
		mode: processingMode,
		scheduleExpression: Type.Optional(scheduleExpression),
		scheduleExpressionTimezone: Type.Optional(scheduleExpressionTimezone),
		priority: Type.Optional(processingPriority),
		engineId: Type.Optional(engineId),
	},
	{ description: 'The processing configuration for the region.' }
);

const boundingBox = Type.Array(Type.Number(), { description: 'The bounding box of the region.' });

const totalArea = Type.Number({ description: 'The total area covered by all polygons under this region.' });

const totalPolygons = Type.Number({ description: 'The total number of polygons under this region.' });
/**
 * Region specific resources
 */

export const createRegionRequestBody = Type.Object(
	{
		name,
		processingConfig,
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'createRegionRequestBody' }
);
export type CreateRegion = Static<typeof createRegionRequestBody>;

export const editRegionRequestBody = Type.Object(
	{
		name: Type.Optional(name),
		processingConfig: Type.Optional(processingConfig),
		attributes: Type.Optional(Type.Ref(attributes)),
		tags: Type.Optional(Type.Ref(tags)),
	},
	{ $id: 'editRegionRequestBody' }
);
export type EditRegion = Static<typeof editRegionRequestBody>;

export type BoundingBox = Static<typeof boundingBox>;

export type UpdateAggregatedPolygonsParameter = {
	boundingBox: BoundingBox;
	totalAreaDelta: number;
	totalPolygonsDelta: number;
};

export const regionResource = Type.Object(
	{
		id: regionId,
		groupId,
		name,
		totalArea,
		totalPolygons,
		processingConfig,
		boundingBox: Type.Optional(boundingBox),
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

export type ProcessingConfig = Static<typeof processingConfig>;

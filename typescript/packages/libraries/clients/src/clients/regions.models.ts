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

export interface Group {
	id: string;
	name: string;
	attributes?: Record<string, string>;
	tags?: Record<string, string>;
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
}

export interface GroupListResources {
	groups: Group[]
}

export type Priority = 'low' | 'standard' | 'high';

export type Mode = 'scheduled' | 'disabled' | 'onNewScene';

export interface ProcessingConfig {
	mode: Mode,
	priority: Priority,
	scheduleExpression: string,
	scheduleExpressionTimezone: string
}

export interface Region {
	id: string;
	groupId: string;
	name: string;
	attributes?: Record<string, string>;
	tags?: Record<string, string>;
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
	processingConfig: ProcessingConfig;
	boundingBox: number[];
}

export interface UpdateRegionParams {
	name?: string;
	attributes?: Record<string, any>
	tags?: Record<string, string | null>
}

export interface State {
	id: string;
	polygonId: string;
	timestamp: string;
	attributes?: Record<string, string>;
	tags?: Record<string, string>;
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
}

export interface Polygon {
	id: string;
	name: string;
	regionId: string;
	boundary: [[[[number, number]]]];
	exclusions?: [[[number, number]]];
	area: number;
	attributes?: Record<string, string>;
	tags?: Record<string, string>;
	state?: State;
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
}

export interface PolygonListResource {
	polygons: Polygon[];
	pagination?: {
		token: string;
		count: number;
	};
}

export interface ListStatesOptions {
	regionId?: string;
	groupId?: string;
	polygonId?: string;
	name?: string;
	paginationToken?: string;
	count?: number;
	includeLatestState?: boolean;
	tags?: string[];
}

export interface ListPolygonsOptions {
	regionId?: string;
	groupId?: string;
	name?: string;
	paginationToken?: string;
	count?: number;
	includeLatestState?: boolean;
	tags?: string[];
}

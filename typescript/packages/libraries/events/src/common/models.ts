import type { GroupDetails, RegionDetails } from '../results/models.js';
import { EngineJobDetails, polygonProcessingDetails } from "../results/models.js";

type EventType = 'created' | 'updated' | 'deleted';

type ResourceType = 'polygons' | 'groups' | 'regions' | 'states' | 'job';

export interface DomainEvent<T> {
	resourceType: ResourceType;
	eventType: EventType;
	id: string;
	old?: T;
	new?: T;
	error?: Error;
}

export const AWS_EVENT_BRIDGE_SCHEDULED_EVENT_SOURCE: string = 'aws.events';
export const ARCADE_EVENT_SOURCE: string = 'com.aws.arcade';
export const RESULTS_EVENT_SOURCE: string = 'com.aws.arcade.results';
export const ENGINE_EVENT_SOURCE: string = 'com.aws.arcade.engine';
export const SCHEDULER_EVENT_SOURCE: string = 'com.aws.arcade.scheduler';
export const REGIONS_EVENT_SOURCE: string = 'com.aws.arcade.regions';
export const EXECUTOR_EVENT_SOURCE: string = 'com.aws.arcade.executor';

// Results module events
export const AWS_EVENT_BRIDGE_SCHEDULED_EVENT: string = 'Scheduled Event';
export const RESULTS_GROUP_CHANGE_EVENT = `${ARCADE_EVENT_SOURCE}>results>group>change`;
export const RESULTS_REGION_CHANGE_EVENT = `${ARCADE_EVENT_SOURCE}>results>region>change`;
export const EXECUTOR_JOB_CREATED_EVENT = `${EXECUTOR_EVENT_SOURCE}>job>created`;
export const EXECUTOR_JOB_UPDATED_EVENT = `${EXECUTOR_EVENT_SOURCE}>job>updated`;
export const EXECUTOR_POLYGON_METADATA_CREATED_EVENT = `${EXECUTOR_EVENT_SOURCE}>polygonMetadata>created`;

export const RESULTS_POLYGON_CREATED_EVENT = `${REGIONS_EVENT_SOURCE}>polygons>created`;
export const RESULTS_POLYGON_UPDATED_EVENT = `${REGIONS_EVENT_SOURCE}>polygons>updated`;
export const RESULTS_POLYGON_DELETED_EVENT = `${REGIONS_EVENT_SOURCE}>polygons>deleted`;
export const RESULTS_REGION_CREATED_EVENT = `${REGIONS_EVENT_SOURCE}>regions>created`;
export const RESULTS_REGION_UPDATED_EVENT = `${REGIONS_EVENT_SOURCE}>regions>updated`;
export const RESULTS_REGION_DELETED_EVENT = `${REGIONS_EVENT_SOURCE}>regions>deleted`;

export interface groupChangeEvent {
	account: string;
	region: string;
	source: string;
	'detail-type': string;
	detail: GroupDetails;
}

export interface regionChangeEvent {
	account: string;
	region: string;
	source: string;
	'detail-type': string;
	detail: RegionDetails;
}

export interface resultsChangeEvent {
	account: string;
	region: string;
	source: string;
	'detail-type': string;
	detail: DomainEvent<EngineJobDetails>;
}

export interface polygonsProcessingEvent {
	account: string;
	region: string;
	source: string;
	'detail-type': string;
	detail: polygonProcessingDetails;
}

export type {
	groupChangeEvent as GroupChangeEvent,
	regionChangeEvent as RegionChangeEvent,
	resultsChangeEvent as ResultsChangeEvent,
	polygonsProcessingEvent as PolygonsProcessingEvent
};

import type { GroupDetails, PipelineMetadataDetails, RegionDetails } from '../results/models.js';

type EventType = 'created' | 'updated' | 'deleted';

type ResourceType = 'zones' | 'groups' | 'regions';

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

// Results module events
export const AWS_EVENT_BRIDGE_SCHEDULED_EVENT: string = 'Scheduled Event';
export const RESULTS_GROUP_CHANGE_EVENT = `${ARCADE_EVENT_SOURCE}>results>group>change`;
export const RESULTS_REGION_CHANGE_EVENT = `${ARCADE_EVENT_SOURCE}>results>region>change`;
export const RESULTS_SCHEDULED_EVENT = `${ARCADE_EVENT_SOURCE}>results>scheduled`;
export const RESULTS_QUEUED_EVENT = `${ARCADE_EVENT_SOURCE}>results>queued`;
export const RESULTS_STARTED_EVENT = `${ARCADE_EVENT_SOURCE}>results>started`;
export const RESULTS_FAILED_EVENT = `${ARCADE_EVENT_SOURCE}>results>failed`;
export const RESULTS_COMPLETED_EVENT = `${ARCADE_EVENT_SOURCE}>results>completed`;
export const RESULTS_ZONE_CREATED_EVENT = `${REGIONS_EVENT_SOURCE}>zones>created`;
export const RESULTS_ZONE_UPDATED_EVENT = `${REGIONS_EVENT_SOURCE}>zones>updated`;

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
	detail: PipelineMetadataDetails;
}

export type { groupChangeEvent as GroupChangeEvent, regionChangeEvent as RegionChangeEvent, resultsChangeEvent as ResultsChangeEvent };

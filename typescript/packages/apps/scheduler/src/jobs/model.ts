import { RegionResource } from '@arcade/events';

export type StartJobRequest = RegionResource & { scheduleDateTime: string };

export interface BatchEngineInput {
	polygonId: string;
	groupId: string;
	regionId: string;
	coordinates: [[number, number]],
	exclusions?: [[[number, number]]];
	scheduleDateTime: string;
}

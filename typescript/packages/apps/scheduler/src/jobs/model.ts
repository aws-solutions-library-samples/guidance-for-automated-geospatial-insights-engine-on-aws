import { RegionResource } from "@arcade/events";

export type StartJobRequest = RegionResource & { scheduleDateTime: string }

export interface BatchEngineInput {
	zoneId: string;
	groupId: string;
	regionId: string;
	coordinates: [[number, number]],
	exclusions?: [[[number, number]]];
	scheduleDateTime: string;
}

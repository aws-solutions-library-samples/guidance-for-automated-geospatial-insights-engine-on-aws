import { Coordinate } from "@arcade/events";

export interface CreateScheduleRequest {
	zoneId: string;
	groupId: string;
	regionId: string;
	coordinates: Coordinate[]
	scheduleExpression: string;
	scheduleExpressionTimezone?: string;
}

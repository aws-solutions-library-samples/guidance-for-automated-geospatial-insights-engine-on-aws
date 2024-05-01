export type Coordinate = [number, number]

export interface ZoneResource {
	zoneId: string;
	groupId: string;
	regionId: string;
	coordinates: Coordinate[]
	scheduleExpression: string;
	scheduleExpressionTimezone?: string;
}

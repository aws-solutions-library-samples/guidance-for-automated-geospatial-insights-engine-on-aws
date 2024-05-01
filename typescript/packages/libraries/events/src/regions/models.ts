export type Coordinate = [number, number]

export interface RegionResource {
	id: string;
	groupId: string;
	name: string;
	scheduleExpression: string;
	scheduleExpressionTimezone?: string;
}

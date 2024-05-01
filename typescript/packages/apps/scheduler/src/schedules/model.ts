export interface CreateScheduleRequest {
	polygonId: string;
	groupId: string;
	regionId: string;
	coordinates: [[number, number]];
	scheduleExpression: string;
	scheduleExpressionTimezone?: string;
}

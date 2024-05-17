export type Priority = 'low' | 'standard' | 'high';

export type Mode = 'scheduled' | 'disabled' | 'onNewScene';

export interface ProcessingConfig {
	mode: Mode,
	priority: Priority,
	scheduleExpression: string,
	scheduleExpressionTimezone: string
}

export interface RegionResource {
	id: string;
	groupId: string;
	name: string;
	processingConfig: ProcessingConfig
}

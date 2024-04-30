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
}

export interface State {
	id: string;
	zoneId: string;
	timestamp: string
	attributes?: Record<string, string>;
	tags?: Record<string, string>;
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
}

export interface Zone {
	id: string;
	name: string;
	regionId: string;
	boundary: [[number, number]];
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

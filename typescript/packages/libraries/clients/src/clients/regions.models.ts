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
	polygonId: string;
	timestamp: string;
	attributes?: Record<string, string>;
	tags?: Record<string, string>;
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
}

export interface Polygon {
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

export interface PolygonListResource {
	polygons: Polygon[],
	pagination?: {
		token: string;
		count: number;
	}
}


export interface ListZonesOptions {
	regionId?: string;
	groupId?: string;
	name?: string;
	paginationToken?: string;
	count?: number;
	includeLatestState?: boolean;
	tags?: string[]
}

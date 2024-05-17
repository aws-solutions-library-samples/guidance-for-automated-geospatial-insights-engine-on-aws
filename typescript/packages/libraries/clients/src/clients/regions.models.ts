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

export interface UpdateRegionParams {
	name?: string;
	attributes?: Record<string, any>
	tags?: Record<string, string | null>
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
	polygons: Polygon[];
	pagination?: {
		token: string;
		count: number;
	};
}

export interface ListStatesOptions {
	regionId?: string;
	groupId?: string;
	polygonId?: string;
	name?: string;
	paginationToken?: string;
	count?: number;
	includeLatestState?: boolean;
	tags?: string[];
}

export interface ListPolygonsOptions {
	regionId?: string;
	groupId?: string;
	name?: string;
	paginationToken?: string;
	count?: number;
	includeLatestState?: boolean;
	tags?: string[];
}

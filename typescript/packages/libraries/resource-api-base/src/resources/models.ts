export interface Resource {
	id: string;
	keyPrefix: string;
	alternateId?: string;
}

export interface ListIdsPaginationTokenKey {
	paginationToken: string;
}


export interface ListIdsPaginationOptions {
	count?: number;
	from?: ListIdsPaginationKey;
}

export interface ListIdsPaginationKey {
	id: string;
	groupId?: string;
}

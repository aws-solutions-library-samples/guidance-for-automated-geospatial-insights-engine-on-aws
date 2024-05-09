export interface ListResultsOptions {
	paginationToken?: string;
	count?: number;
}

export interface ResultResource {
	regionId: string;
	id: string;
	scheduleDateTime: string;
	executionId: string;
	createdAt: string;
	updatedAt?: string;
	message?: string;
	engineType: string;
	status: string;
}

export interface ResultListResource {
	results: ResultResource[]
	pagination?: {
		count: number;
		lastEvaluatedToken: string;
	}
}

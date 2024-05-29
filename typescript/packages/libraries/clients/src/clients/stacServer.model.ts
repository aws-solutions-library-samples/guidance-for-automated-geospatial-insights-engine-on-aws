export interface SearchRequest {
	limit?: number;
	bbox: number[];
	datetime?: string;
	ids?: string[];
	collections: string[];
	query?: Record<string, any>
}

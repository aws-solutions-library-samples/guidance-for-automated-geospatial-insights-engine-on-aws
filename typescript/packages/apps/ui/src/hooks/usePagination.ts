/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { useEffect, useMemo, useState } from 'react';

export interface PaginationProps<T> {
	apiPageSize: number; // Number of items requested in each API call
	responsePageSize: number; // Number of items in each page of the response data
	data: T[]; // Extracted data array from the API response
	setApiPaginationToken: (token?: string) => void; // Function to trigger the api with a new token
	apiPaginationResponse?: { count?: number; token?: string }; // Extracted pagination data from the API response
}

export interface PaginationResponse<T> {
	currentPage: number; // The current page to be rendered in the pagination component
	openEnd: boolean; // Whether the pagination component should have an open end
	handlePageChange: (requestedPage: number) => void; // Function to call to request a new page number
	maxKnownPage: number; // Page number to display as the max page in the pagination component
	items: T[]; // Paginated slice of the input data array
}

/**
 * This custom hook abstracts the logic needed to paginate through api responses
 */
export default function usePagination<T>(props: PaginationProps<T>): PaginationResponse<T> {
	const { apiPageSize, responsePageSize, data, setApiPaginationToken, apiPaginationResponse } = props;
	const openEnd = apiPaginationResponse?.token ? true : false;
	const pageRatio = apiPageSize / responsePageSize;
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [maxKnownPage, setMaxKnownPage] = useState<number>(1);
	const apiPage = Math.ceil(currentPage / pageRatio);
	const [paginationTokenMap, setPaginationTokenMap] = useState<Map<number, string>>(new Map());
	const dataLen = data.length;
	const maxPageWithLoadedData = Math.ceil(dataLen / responsePageSize) + (apiPage - 1) * pageRatio;
	const dataStart = ((currentPage - 1) % pageRatio) * responsePageSize;
	const dataEnd = Math.min(dataLen, dataStart + responsePageSize);
	const items = useMemo(() => data.slice(dataStart, dataEnd), [data, dataStart, dataEnd]);

	useEffect(() => {
		setMaxKnownPage((prev) => Math.max(prev, maxPageWithLoadedData));
	}, [data]);

	const handlePageChange = (requestedPage: number) => {
		const requestedApiPage = Math.ceil(requestedPage / pageRatio);
		if (requestedApiPage === apiPage) {
			// No need to make a new api call
			setCurrentPage(requestedPage);
		} else {
			if (apiPaginationResponse?.token) {
				// Store current pagination token
				setPaginationTokenMap((prevMap) => {
					const newMap = new Map(prevMap);
					newMap.set(apiPage, apiPaginationResponse.token!);
					return newMap;
				});
			}
			if (requestedApiPage === 1) {
				setApiPaginationToken(undefined);
				setCurrentPage(requestedPage);
			} else if (requestedApiPage === apiPage + 1) {
				setApiPaginationToken(props.apiPaginationResponse!.token);
				setCurrentPage(requestedPage);
			} else if (paginationTokenMap.has(requestedApiPage)) {
				// Go to another page
				setApiPaginationToken(paginationTokenMap.get(requestedApiPage));
				setCurrentPage(requestedPage);
			} else {
				console.warn('Requested page not available');
			}
		}
	};
	return {
		currentPage,
		openEnd,
		handlePageChange,
		items,
		maxKnownPage,
	};
}

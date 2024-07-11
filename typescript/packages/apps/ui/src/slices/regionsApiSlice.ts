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

import {
	CreateGroup,
	CreatePolygon,
	CreateRegion,
	CreateState,
	EditGroup,
	EditPolygon,
	EditRegion,
	EditState,
	Group,
	GroupList,
	Polygon,
	PolygonList,
	Region,
	RegionList,
	State,
	StateList,
} from '@arcade/regions';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { fetchAuthSession } from 'aws-amplify/auth';

interface ListPaginationOptions {
	count?: number;
	paginationToken?: string;
}

interface TagFilterOptions {
	tags?: string[];
}
interface GroupListFilterOptions {
	name?: string;
}
interface RegionListFilterOptions {
	name?: string;
	groupId?: string;
}
interface PolygonListFilterOptions {
	name?: string;
	groupId?: string;
	regionId?: string;
	includeLatestState?: boolean;
}
interface StateListFilterOptions {
	name?: string;
	groupId?: string;
	regionId?: string;
	polygonId?: string;
	latestOnly?: boolean;
}

function providesList<R extends { id: string }[], T extends string>(resultsWithIds: R | undefined, tagType: T) {
	return resultsWithIds ? [{ type: tagType, id: 'LIST' }, ...resultsWithIds.map(({ id }) => ({ type: tagType, id }))] : [{ type: tagType, id: 'LIST' }];
}

function invalidatesList<R extends string, T extends string>(id: R, tagType: T) {
	return [
		{ type: tagType, id: 'LIST' },
		{ type: tagType, id },
	];
}

const regionsApiUrl = import.meta.env.VITE_REGIONS_API_URL;
export const getToken: () => Promise<string> = async () => {
	return (await fetchAuthSession()).tokens?.idToken?.toString() ?? '';
};
export const regionsApiSlice = createApi({
	reducerPath: 'demoApi',
	baseQuery: fetchBaseQuery({
		baseUrl: regionsApiUrl,
		prepareHeaders: async (headers) => {
			const accessToken = await getToken();
			headers.set('Authorization', `Bearer ${accessToken}`);
			headers.set('accept', 'application/json');
			headers.set('accept-version', '1.0.0');
			return headers;
		},
	}),
	tagTypes: ['Group', 'Region', 'Polygon', 'State'],
	endpoints: (builder) => ({
		// Groups
		listGroups: builder.query<GroupList, ListPaginationOptions & TagFilterOptions & GroupListFilterOptions>({
			query: ({ count, paginationToken, name }) => ({
				url: `/groups`,
				mode: 'cors',
				method: 'GET',
				params: {
					count,
					paginationToken,
					name,
				},
			}),
			providesTags: (result) => providesList(result?.groups, 'Group'),
		}),
		getGroup: builder.query<Group, string>({
			query: (id) => ({
				url: `/groups/${id}`,
				mode: 'cors',
				method: 'GET',
			}),
			providesTags: (_result, _error, id) => [{ type: 'Group', id }],
		}),
		createGroup: builder.mutation<Group, CreateGroup>({
			query: (body) => ({
				url: `/groups`,
				mode: 'cors',
				method: 'POST',
				body,
			}),
			invalidatesTags: [{ type: 'Group', id: 'LIST' }],
		}),
		updateGroup: builder.mutation<Group, { id: string; body: EditGroup }>({
			query: ({ id, body }) => ({
				url: `/groups/${id}`,
				mode: 'cors',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => invalidatesList(id, 'Group'),
		}),
		deleteGroup: builder.mutation<void, string>({
			query: (id) => ({
				url: `/groups/${id}`,
				mode: 'cors',
				method: 'DELETE',
			}),
			invalidatesTags: (_result, _error, id) => invalidatesList(id, 'Group'),
		}),

		// Regions
		listRegions: builder.query<RegionList, ListPaginationOptions & TagFilterOptions & RegionListFilterOptions>({
			query: ({ groupId, count, paginationToken }) => ({
				url: `/regions`,
				mode: 'cors',
				method: 'GET',
				params: {
					groupId,
					count,
					paginationToken,
				},
			}),
			providesTags: (result) => providesList(result?.regions, 'Region'),
		}),
		getRegion: builder.query<Region, string>({
			query: (id) => ({
				url: `/regions/${id}`,
				mode: 'cors',
				method: 'GET',
			}),
			providesTags: (_result, _error, id) => [{ type: 'Region', id }],
		}),
		createRegion: builder.mutation<Region, { groupId: string; body: CreateRegion }>({
			query: ({ groupId, body }) => ({
				url: `/groups/${groupId}/regions`,
				mode: 'cors',
				method: 'POST',
				body,
			}),
			invalidatesTags: (_result, _error, { groupId }) => [{ type: 'Region', id: 'LIST' }, ...invalidatesList(groupId, 'Group')],
		}),
		updateRegion: builder.mutation<Region, { id: string; body: EditRegion }>({
			query: ({ id, body }) => ({
				url: `/regions/${id}`,
				mode: 'cors',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => invalidatesList(id, 'Region'),
		}),
		deleteRegion: builder.mutation<void, string>({
			query: (id) => ({
				url: `/regions/${id}`,
				mode: 'cors',
				method: 'DELETE',
			}),
			// Should invalidate parent group
			invalidatesTags: (_result, _error, id) => [...invalidatesList(id, 'Region')],
		}),

		// Polygons
		listPolygons: builder.query<PolygonList, ListPaginationOptions & TagFilterOptions & PolygonListFilterOptions>({
			query: ({ groupId, regionId, includeLatestState, count, paginationToken }) => ({
				url: `/polygons`,
				mode: 'cors',
				method: 'GET',
				params: {
					groupId,
					regionId,
					includeLatestState,
					count,
					paginationToken,
				},
			}),
			providesTags: (result) => providesList(result?.polygons, 'Polygon'),
		}),
		getPolygon: builder.query<Polygon, string>({
			query: (id) => ({
				url: `/polygons/${id}`,
				mode: 'cors',
				method: 'GET',
			}),
			providesTags: (_result, _error, id) => [{ type: 'Polygon', id }],
		}),
		createPolygon: builder.mutation<Polygon, CreatePolygon>({
			query: (body) => ({
				url: `/polygons`,
				mode: 'cors',
				method: 'POST',
				body,
			}),
			invalidatesTags: [{ type: 'Polygon', id: 'LIST' }],
		}),
		updatePolygon: builder.mutation<Polygon, { id: string; body: EditPolygon }>({
			query: ({ id, body }) => ({
				url: `/polygons/${id}`,
				mode: 'cors',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => invalidatesList(id, 'Polygon'),
		}),
		deletePolygon: builder.mutation<void, string>({
			query: (id) => ({
				url: `/polygons/${id}`,
				mode: 'cors',
				method: 'DELETE',
			}),
			invalidatesTags: (_result, _error, id) => invalidatesList(id, 'Polygon'),
		}),

		// States
		listStates: builder.query<StateList, ListPaginationOptions & TagFilterOptions & StateListFilterOptions>({
			query: ({ polygonId, latestOnly, count, paginationToken }) => ({
				url: `/states`,
				mode: 'cors',
				method: 'GET',
				params: {
					polygonId,
					latestOnly,
					count,
					paginationToken,
				},
			}),
			providesTags: (result) => providesList(result?.states, 'State'),
		}),
		getState: builder.query<State, string>({
			query: (id) => ({
				url: `/states/${id}`,
				mode: 'cors',
				method: 'GET',
			}),
			providesTags: (_result, _error, id) => [{ type: 'State', id }],
		}),
		createState: builder.mutation<State, CreateState>({
			query: (body) => ({
				url: `/states`,
				mode: 'cors',
				method: 'POST',
				body,
			}),
			invalidatesTags: [{ type: 'State', id: 'LIST' }],
		}),
		updateState: builder.mutation<State, { id: string; body: EditState }>({
			query: ({ id, body }) => ({
				url: `/states/${id}`,
				mode: 'cors',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => invalidatesList(id, 'State'),
		}),
		deleteState: builder.mutation<void, string>({
			query: (id) => ({
				url: `/states/${id}`,
				mode: 'cors',
				method: 'DELETE',
			}),
			invalidatesTags: (_result, _error, id) => invalidatesList(id, 'State'),
		}),
	}),
});
export const {
	useListGroupsQuery,
	useGetGroupQuery,
	useCreateGroupMutation,
	useUpdateGroupMutation,
	useDeleteGroupMutation,
	useListRegionsQuery,
	useGetRegionQuery,
	useCreateRegionMutation,
	useUpdateRegionMutation,
	useDeleteRegionMutation,
	useListPolygonsQuery,
	useGetPolygonQuery,
	useCreatePolygonMutation,
	useUpdatePolygonMutation,
	useDeletePolygonMutation,
	useListStatesQuery,
	useGetStateQuery,
	useCreateStateMutation,
	useUpdateStateMutation,
	useDeleteStateMutation,
} = regionsApiSlice;

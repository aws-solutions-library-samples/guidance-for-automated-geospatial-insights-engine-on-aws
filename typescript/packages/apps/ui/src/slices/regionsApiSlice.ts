import { Group, GroupList } from '@arcade/regions';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { fetchAuthSession } from 'aws-amplify/auth';

export const getToken: () => Promise<string> = async () => {
	return (await fetchAuthSession()).tokens?.idToken?.toString() ?? '';
};

const regionsApiUrl = import.meta.env.VITE_REGIONS_API_URL;
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
	endpoints: (builder) => ({
		listGroups: builder.query<GroupList, { count?: number; paginationToken?: string }>({
			query: ({ count, paginationToken }) => ({
				url: `/groups`,
				mode: 'cors',
				method: 'GET',
				params: {
					count,
					paginationToken,
				},
			}),
		}),
		getGroup: builder.query<Group, string>({
			query: (id) => ({
				url: `/groups/${id}`,
				mode: 'cors',
				method: 'GET',
			}),
		}),
	}),
});
export const { useListGroupsQuery, useGetGroupQuery } = regionsApiSlice;

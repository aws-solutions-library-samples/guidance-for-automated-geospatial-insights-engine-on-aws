import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ArcadeFeature } from '../pages/Analysis/CloudscapeMap';

interface FeatureFilterOptions {
	group_id?: string;
	region_id?: string;
	polygon_id?: string;
	timestamp?: string;
}

interface ListFeaturesOptions extends FeatureFilterOptions {
	bbox: number[];
}

interface GetFeatureOptions {
	collection_id: string;
	item_id: string;
}

const tilerApiUrl = import.meta.env.VITE_UI_REST_API_URL;
export const getToken: () => Promise<string> = async () => {
	return (await fetchAuthSession()).tokens?.idToken?.toString() ?? '';
};
export const tilerApiSlice = createApi({
	reducerPath: 'tilerApi',
	baseQuery: fetchBaseQuery({
		baseUrl: tilerApiUrl,
		prepareHeaders: async (headers) => {
			const accessToken = await getToken();
			headers.set('Authorization', `Bearer ${accessToken}`);
			headers.set('accept', 'application/json');
			return headers;
		},
	}),
	endpoints: (builder) => ({
		getFeatures: builder.query<ArcadeFeature[], ListFeaturesOptions>({
			query: ({ group_id, region_id, polygon_id, timestamp, bbox }) => ({
				url: `/features`,
				mode: 'cors',
				method: 'GET',
				params: {
					group_id,
					region_id,
					polygon_id,
					timestamp,
					bbox: JSON.stringify(bbox),
				},
			}),
		}),
		getFeature: builder.query<ArcadeFeature, GetFeatureOptions>({
			query: ({ collection_id, item_id }) => ({
				url: `/feature`,
				mode: 'cors',
				method: 'GET',
				params: {
					collection_id,
					item_id,
				},
			}),
		}),
	}),
});
export const { useGetFeaturesQuery, useGetFeatureQuery } = tilerApiSlice;

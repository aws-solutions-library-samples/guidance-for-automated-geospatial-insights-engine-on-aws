import { Tags } from '@arcade/regions';
import { spec, stash } from 'pactum';
import Spec from 'pactum/src/models/Spec.js';
import path from 'path';
import { initializeConfig } from '../utils/config.js';
import { COMMON_HEADERS } from '../utils/headers.js';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';

// load config from dotenv
initializeConfig(path.join(__dirname, '..', '..'));

export const PAGINATION_ATTRIBUTE = 'pagination_attribute';

export const BASE_URL = process.env.ARCADE_REGIONS_BASE_URL;

type BaseExpectArgs = {
	expectStatus: number;
};
type RequestBodyExpectArgs = {
	withJson: object;
	withTags?: Tags;
	expectJsonLike?: object;
};
type ResponseBodyExpectArgs = {
	expectJsonLike?: object;
};
type IdExpectArgs = {
	id: string;
};
type ParentIdExpectArgs = {
	parentId: string;
};

export type CreateArgs = BaseExpectArgs & RequestBodyExpectArgs & ResponseBodyExpectArgs;
export type CreateArgsWithParent = CreateArgs & ParentIdExpectArgs;
export type UpdateArgs = BaseExpectArgs & RequestBodyExpectArgs & ResponseBodyExpectArgs & IdExpectArgs;
export type GetArgs = BaseExpectArgs & ResponseBodyExpectArgs & IdExpectArgs;
export type ListExpectArgs = BaseExpectArgs & {
	withCount?: number;
	withToken?: string;
	withPolygonId?: string;
	withRegionId?: string;
	withGroupId?: string;
	withTags?: Tags;
	expectCount?: number;
	expectJsonLike: object;
};
export type DeleteArgs = Omit<BaseExpectArgs, 'expectStatus'> &
	IdExpectArgs & {
		expectStatus?: number;
	};

export const initializeCommonDataStash = () => {
	// data templates are a way to reuse json objects across tests
	stash.addDataTemplate({
		[PAGINATION_ATTRIBUTE]: {
			pagination: {
				token: PAGINATION_TOKEN_PATTERN,
				count: 2,
			},
		},
	});
};

export const createResource = (resourcePlural: string, args: CreateArgs, parentResourcePlural?: string, parentId?: string): Spec => {
	const url = parentId ? `${BASE_URL}/${parentResourcePlural}/${parentId}/${resourcePlural}` : `${BASE_URL}/${resourcePlural}`;

	let s = spec().post(url).withJson(args.withJson).withHeaders(COMMON_HEADERS).expectStatus(args.expectStatus);

	let requestBody = args.withJson;
	if (args.withTags) {
		requestBody['tags'] = { ...requestBody['tags'], ...args.withTags };
	}
	s = s.withJson(requestBody);

	if (args.expectJsonLike) {
		s = s.expectJsonLike(args.expectJsonLike);
	}
	if (args.expectStatus === 201) {
		s = s.expectHeaderContains('content-type', 'application/json');
	}
	return s;
};

export const updateResource = (resourcePlural: string, args: UpdateArgs): Spec => {
	let s = spec().patch(`${BASE_URL}/${resourcePlural}/{id}`).withPathParams('id', args.id).withJson(args.withJson).withHeaders(COMMON_HEADERS).expectStatus(args.expectStatus);
	if (args.expectJsonLike) {
		s = s.expectJsonLike(args.expectJsonLike);
	}
	if (args.expectStatus === 201) {
		s = s.expectHeaderContains('content-type', 'application/json');
	}
	return s;
};

export const getResource = (resourcePlural: string, args: GetArgs): Spec => {
	let s = spec().get(`${BASE_URL}/${resourcePlural}/{id}`).withPathParams('id', args.id).withHeaders(COMMON_HEADERS).expectStatus(args.expectStatus);
	if (args.expectJsonLike) {
		s = s.expectJsonLike(args.expectJsonLike);
	}
	if (args.expectStatus === 200) {
		s = s.expectHeaderContains('content-type', 'application/json');
	}
	return s;
};

export const listResources = (resourcePlural: string, args: ListExpectArgs): Spec => {
	let s = spec().get(`${BASE_URL}/${resourcePlural}`).withHeaders(COMMON_HEADERS).expectStatus(args.expectStatus);
	if (args.withCount) {
		s = s.withQueryParams('count', args.withCount);
	}
	if (args.withToken) {
		// s = s.withQueryParams('paginationToken', encodeURIComponent(args.withToken));
		s = s.withQueryParams('paginationToken', args.withToken);
	}
	if (args.withPolygonId) {
		s = s.withQueryParams('polygonId', args.withPolygonId);
	}
	if (args.withRegionId) {
		s = s.withQueryParams('regionId', args.withRegionId);
	}
	if (args.withGroupId) {
		s = s.withQueryParams('groupId', args.withGroupId);
	}
	if (args.withTags) {
		Object.entries(args.withTags).forEach(([key, value]) => {
			s = s.withQueryParams('tags', `${key}:${value}`);
		});
	}
	if (args.expectJsonLike) {
		s = s.expectJsonLike(args.expectJsonLike);
	}
	if (args.expectCount) {
		s = s.expectJsonLength(resourcePlural, args.expectCount);
	}
	if (args.expectStatus === 200) {
		s = s.expectHeaderContains('content-type', 'application/json');
	}
	return s;
};

export const deleteResource = (resourcePlural: string, args: DeleteArgs): Spec => {
	let s = spec().delete(`${BASE_URL}/${resourcePlural}/{id}`).withPathParams('id', args.id).withHeaders(COMMON_HEADERS);
	if (args.expectStatus) {
		s = s.expectStatus(args.expectStatus);
	}
	return s;
};

export const teardownResources = async <T>(resourcePlural: string, tagKey: string, tagValue: string, queryString?: Record<string, unknown>) => {
	let token: string;
	do {
		let s = spec().get(`${BASE_URL}/${resourcePlural}`).withQueryParams('tags', `${tagKey}:${tagValue}`).withQueryParams('count', '100').withHeaders(COMMON_HEADERS);

		if (queryString) {
			s = s.withQueryParams(queryString);
		}

		const response = await s.expectStatus(200).returns('.');
		const resources: T[] = response[resourcePlural];
		token = response['pagination']?.['token'];

		// console.log(`Deleting ${resourcePlural} ${resources.map((r) => r['id'])}`);

		for (const r of resources) {
			await deleteResource(resourcePlural, { id: r['id'] }).toss();
		}
	} while (token);
};

import { Tags } from '@arcade/regions';
import { request, spec, stash } from 'pactum';
import Spec from 'pactum/src/models/Spec.js';
import path from 'path';
import { initializeConfig } from '../utils/config.js';
import { COMMON_HEADERS } from '../utils/headers.js';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Client } from "@opensearch-project/opensearch";


request.setDefaultTimeout(5000)

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
type AuthExpectArgs = {
	withIdToken: string;
};

export type CreateArgs = BaseExpectArgs & RequestBodyExpectArgs & ResponseBodyExpectArgs & AuthExpectArgs;
export type CreateArgsWithParent = CreateArgs & ParentIdExpectArgs;
export type UpdateArgs = BaseExpectArgs & RequestBodyExpectArgs & ResponseBodyExpectArgs & IdExpectArgs & AuthExpectArgs;
export type GetArgs = BaseExpectArgs & ResponseBodyExpectArgs & IdExpectArgs & AuthExpectArgs;
export type ListExpectArgs = BaseExpectArgs &
	AuthExpectArgs & {
	withContentHeader?: string;
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
	IdExpectArgs &
	AuthExpectArgs & {
	expectStatus?: number;
};

const secretsManagerClient = new SecretsManagerClient({ region: process.env['AWS_REGION'] });
const secrets = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: process.env['STAC_OS_SECRET_NAME'] }))
const { username, password } = JSON.parse(secrets.SecretString)
const openSearchClient = new Client({
	node: `https://${username}:${password}@${process.env['STAC_OS_SERVER_URL']}`,
})

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

export const createResourcesMethodForModules = (module: 'results' | 'regions' | 'notifications' | 'stac') => {

	let baseUrl: string;
	switch (module) {
		case 'regions':
			baseUrl = process.env.ARCADE_REGIONS_BASE_URL
			break;
		case 'results':
			baseUrl = process.env.ARCADE_RESULTS_BASE_URL
			break;
		case 'notifications':
			baseUrl = process.env.ARCADE_NOTIFICATIONS_BASE_URL
			break;
		case 'stac':
			baseUrl = process.env.STAC_API_URL
			break;
	}

	const createResource = (resourcePlural: string, args: CreateArgs, parentResourcePlural?: string, parentId?: string): Spec => {
		const url = parentId ? `${baseUrl}${parentResourcePlural}/${parentId}/${resourcePlural}` : `${BASE_URL}${resourcePlural}`;
		let s = spec().post(url).withJson(args.withJson).withHeaders(COMMON_HEADERS(args.withIdToken)).expectStatus(args.expectStatus);

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

	const updateResource = (resourcePlural: string, args: UpdateArgs): Spec => {
		let s = spec()
			.patch(`${baseUrl}${resourcePlural}/{id}`)
			.withPathParams('id', args.id)
			.withJson(args.withJson)
			.withHeaders(COMMON_HEADERS(args.withIdToken))
			.expectStatus(args.expectStatus);
		if (args.expectJsonLike) {
			s = s.expectJsonLike(args.expectJsonLike);
		}
		if (args.expectStatus === 201) {
			s = s.expectHeaderContains('content-type', 'application/json');
		}
		return s;
	};

	const getResource = (resourcePlural: string, args: GetArgs): Spec => {
		let s = spec().get(`${baseUrl}${resourcePlural}/{id}`).withPathParams('id', args.id).withHeaders(COMMON_HEADERS(args.withIdToken)).expectStatus(args.expectStatus);
		if (args.expectJsonLike) {
			s = s.expectJsonLike(args.expectJsonLike);
		}
		if (args.expectStatus === 200) {
			s = s.expectHeaderContains('content-type', 'application/json');
		}
		return s;
	};

	const listResources = (resourcePlural: string, args: ListExpectArgs): Spec => {
		let s = spec().get(`${baseUrl}${resourcePlural}`).withHeaders(COMMON_HEADERS(args.withIdToken)).expectStatus(args.expectStatus);

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
			s = s.expectHeaderContains('content-type', args.withContentHeader ?? 'application/json');
		}
		return s;
	};

	const deleteResource = (resourcePlural: string, args: DeleteArgs): Spec => {
		let s = spec().delete(`${baseUrl}${resourcePlural}/{id}`).withPathParams('id', args.id).withHeaders(COMMON_HEADERS(args.withIdToken));
		if (args.expectStatus) {
			s = s.expectStatus(args.expectStatus);
		}
		return s;
	};

	const teardownResources = async <T>(resourcePlural: string, tagKey: string, tagValue: string, idToken: string, queryString?: Record<string, unknown>) => {
		let token: string;
		do {
			let s = spec().get(`${baseUrl}${resourcePlural}`).withQueryParams('tags', `${tagKey}:${tagValue}`).withQueryParams('count', '100').withHeaders(COMMON_HEADERS(idToken));

			if (queryString) {
				s = s.withQueryParams(queryString);
			}

			const response = await s.expectStatus(200).returns('.');
			const resources: T[] = response[resourcePlural];
			token = response['pagination']?.['token'];

			for (const r of resources) {
				await deleteResource(resourcePlural, { id: r['id'], withIdToken: idToken }).toss();
				try {
					if (resourcePlural === 'groups') {
						await openSearchClient.indices.delete({ index: `group_${r['id']}` });
					} else if (resourcePlural === 'regions') {
						await openSearchClient.indices.delete({ index: `region_${r['id']}` });
					}
				} catch (e) {
					if (!e.message.includes('index_not_found_exception')) {
						throw e;
					}
				}
			}
		} while (token);
	};

	return {
		createResource, deleteResource, updateResource, listResources, teardownResources, getResource
	}

}


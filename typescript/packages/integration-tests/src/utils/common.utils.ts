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

import { Tags } from '@agie/regions';
import { request, spec, stash } from 'pactum';
import Spec from 'pactum/src/models/Spec.js';
import path from 'path';
import { initializeConfig } from '../utils/config.js';
import { COMMON_HEADERS } from '../utils/headers.js';
import { PAGINATION_TOKEN_PATTERN } from '../utils/regex.js';
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Client } from "@opensearch-project/opensearch";
import pWaitFor from "p-wait-for";
import { Credentials, Request as AWS4Request, sign } from "aws4";

request.setDefaultTimeout(5000)

// load config from dotenv
initializeConfig(path.join(__dirname, '..', '..'));

export const PAGINATION_ATTRIBUTE = 'pagination_attribute';

export const BASE_URL = process.env.AGIE_REGIONS_BASE_URL;

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
	withIdToken?: string;
	withIAMCredentials?: Credentials;
};

export type CreateArgs = BaseExpectArgs & RequestBodyExpectArgs & ResponseBodyExpectArgs & AuthExpectArgs;
export type CreateArgsWithParent = CreateArgs & ParentIdExpectArgs;
export type UpdateArgs =
	BaseExpectArgs
	& RequestBodyExpectArgs
	& ResponseBodyExpectArgs
	& IdExpectArgs
	& AuthExpectArgs;
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

export const signResourceUrl = (baseUrl: string, resourcePlural: string, args: ListExpectArgs | GetArgs): string => {
	const [host, stage] = baseUrl.replace('https://', '').split('/');
	const signingOptions: AWS4Request = {
		method: 'GET',
		host,
		path: `/${stage}/${resourcePlural}`,
		region: process.env['AWS_REGION'],
		service: 'execute-api',
		headers: COMMON_HEADERS(args.withIdToken),
		signQuery: true
	};
	sign(signingOptions, args.withIAMCredentials);
	resourcePlural = `${signingOptions.path.replace(`/${stage}/`, '')}`
	return resourcePlural;
}

export const createResourcesMethodForModules = (module: 'results' | 'regions' | 'notifications' | 'stac') => {

	let baseUrl: string;
	switch (module) {
		case 'regions':
			baseUrl = process.env.AGIE_REGIONS_BASE_URL
			break;
		case 'results':
			baseUrl = process.env.AGIE_RESULTS_BASE_URL
			break;
		case 'notifications':
			baseUrl = process.env.AGIE_NOTIFICATIONS_BASE_URL
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

	const waitForGetResource = async (resourcePlural: string, args: GetArgs, waitConfiguration?: {
		interval: number,
		timeout: number
	}): Promise<void> => {
		await pWaitFor(async (): Promise<any> => {
			try {
				await getResource(resourcePlural, args).toss();
				return true;
			} catch (e) {
				if (e.code === 'ERR_ASSERTION') {
					return false;
				} else {
					throw e;
				}
			}
		}, { interval: waitConfiguration?.interval ?? 1000, timeout: waitConfiguration?.timeout ?? 5000 });
	}

	const getResource = (resourcePlural: string, args: GetArgs): Spec => {
		if (args.withIAMCredentials) {
			resourcePlural = signResourceUrl(baseUrl, resourcePlural, args);
		}

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
		if (args.withIAMCredentials) {
			resourcePlural = signResourceUrl(baseUrl, resourcePlural, args);
		}

		let s = spec().get(`${baseUrl}${resourcePlural}`).withHeaders(COMMON_HEADERS(args.withIdToken)).expectStatus(args.expectStatus);

		if (args.withCount) {
			s = s.withQueryParams('count', args.withCount);
		}
		if (args.withToken) {
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
			}
		} while (token);
	};

	return {
		createResource, deleteResource, updateResource, listResources, teardownResources, getResource, waitForGetResource
	}

}


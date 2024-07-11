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

import { GetFunctionConfigurationCommand, InvokeCommand, LambdaClient, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { CloudFormationCustomResourceEvent, } from "aws-lambda";
import { fromUtf8 } from '@aws-sdk/util-utf8-node';
import axios from 'axios';

const { ADMIN_SECRET_NAME, USER_SECRET_NAME, STAC_ENDPOINT, AWS_REGION, STAC_INGEST_LAMBDA, INGESTION_TOPIC_ARN, STAC_ROLE_NAME, STAC_API_LAMBDA, STAC_API_URL } = process.env

const secretsManagerClient = new SecretsManagerClient({ region: AWS_REGION });
const lambdaClient = new LambdaClient({ region: AWS_REGION });
const snsClient = new SNSClient({ region: AWS_REGION });

export interface Credentials {
	username: string;
	password: string;
}

const polygonIndexMapping: Record<string, any> = {
	"dynamic_templates": [
		{
			"descriptions": {
				"match": "description",
				"match_mapping_type": "string",
				"mapping": {
					"type": "text"
				}
			}
		},
		{
			"titles": {
				"match": "title",
				"match_mapping_type": "string",
				"mapping": {
					"type": "text"
				}
			}
		},
		{
			"proj_epsg": {
				"match": "proj:epsg",
				"mapping": {
					"type": "integer"
				}
			}
		},
		{
			"proj_projjson": {
				"match": "proj:projjson",
				"mapping": {
					"enabled": false,
					"type": "object"
				}
			}
		},
		{
			"proj_centroid": {
				"match": "proj:centroid",
				"mapping": {
					"type": "geo_point"
				}
			}
		},
		{
			"proj_geometry": {
				"match": "proj:geometry",
				"mapping": {
					"enabled": false,
					"type": "object"
				}
			}
		},
		{
			"proj_transform": {
				"match": "proj:transform",
				"mapping": {
					"enabled": false,
					"type": "object"
				}
			}
		},
		{
			"no_index_href": {
				"match": "href",
				"mapping": {
					"index": false,
					"type": "text"
				}
			}
		},
		{
			"strings": {
				"match_mapping_type": "string",
				"mapping": {
					"type": "keyword"
				}
			}
		},
		{
			"numerics": {
				"match_mapping_type": "long",
				"mapping": {
					"type": "float"
				}
			}
		}
	],
	"numeric_detection": false,
	"properties": {
		"assets": {
			"enabled": false,
			"type": "object"
		},
		"bbox": {
			"type": "float"
		},
		"collection": {
			"type": "keyword"
		},
		"geometry": {
			"type": "geo_shape"
		},
		"id": {
			"type": "keyword"
		},
		"links": {
			"enabled": false,
			"type": "object"
		},
		"properties": {
			"type": "object",
			"properties": {
				"area_size": {
					"type": "float"
				},
				"area_unit_of_measure": {
					"type": "keyword"
				},
				"created": {
					"type": "date"
				},
				"crop_type": {
					"type": "keyword"
				},
				"datetime": {
					"type": "date"
				},
				"end_datetime": {
					"type": "date"
				},
				"planted_at": {
					"type": "date"
				},
				"sat:absolute_orbit": {
					"type": "integer"
				},
				"sat:relative_orbit": {
					"type": "integer"
				},
				"start_datetime": {
					"type": "date"
				},
				"updated": {
					"type": "date"
				}
			}
		},
		"stac_version": {
			"type": "keyword"
		},
		"type": {
			"type": "keyword"
		}
	}
}

const regionIndexMapping: Record<string, any> = {
	"dynamic_templates": [
		{
			"descriptions": {
				"match": "description",
				"match_mapping_type": "string",
				"mapping": {
					"type": "text"
				}
			}
		},
		{
			"titles": {
				"match": "title",
				"match_mapping_type": "string",
				"mapping": {
					"type": "text"
				}
			}
		},
		{
			"proj_epsg": {
				"match": "proj:epsg",
				"mapping": {
					"type": "integer"
				}
			}
		},
		{
			"proj_projjson": {
				"match": "proj:projjson",
				"mapping": {
					"enabled": false,
					"type": "object"
				}
			}
		},
		{
			"proj_centroid": {
				"match": "proj:centroid",
				"mapping": {
					"type": "geo_point"
				}
			}
		},
		{
			"proj_geometry": {
				"match": "proj:geometry",
				"mapping": {
					"enabled": false,
					"type": "object"
				}
			}
		},
		{
			"proj_transform": {
				"match": "proj:transform",
				"mapping": {
					"enabled": false,
					"type": "object"
				}
			}
		},
		{
			"no_index_href": {
				"match": "href",
				"mapping": {
					"index": false,
					"type": "text"
				}
			}
		},
		{
			"strings": {
				"match_mapping_type": "string",
				"mapping": {
					"type": "keyword"
				}
			}
		},
		{
			"numerics": {
				"match_mapping_type": "long",
				"mapping": {
					"type": "float"
				}
			}
		}
	],
	"numeric_detection": false,
	"properties": {
		"assets": {
			"enabled": false,
			"type": "object"
		},
		"bbox": {
			"type": "float"
		},
		"collection": {
			"type": "keyword"
		},
		"geometry": {
			"type": "geo_shape"
		},
		"id": {
			"type": "keyword"
		},
		"links": {
			"enabled": false,
			"type": "object"
		},
		"properties": {
			"type": "object",
			"properties": {
				"arcade:isActive": {
					"type": "boolean"
				},
				"arcade:processedOnNewScene": {
					"type": "boolean"
				},
				"created": {
					"type": "date"
				},
				"createdAt": {
					"type": "date"
				},
				"datetime": {
					"type": "date"
				},
				"end_datetime": {
					"type": "date"
				},
				"sat:absolute_orbit": {
					"type": "integer"
				},
				"sat:relative_orbit": {
					"type": "integer"
				},
				"start_datetime": {
					"type": "date"
				},
				"updated": {
					"type": "date"
				},
				"updatedAt": {
					"type": "date"
				}
			}
		},
		"stac_version": {
			"type": "keyword"
		},
		"type": {
			"type": "keyword"
		}
	}
}

const createIndices = async (adminCredentials: Credentials, indexName: string, mappings: Record<string, any>): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchUser> in:`);
	const result = await axios.put(`https://${STAC_ENDPOINT}/${indexName}` as string, {
		"mappings": mappings
	}, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: adminCredentials.username,
			password: adminCredentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchUser> exit> result: ${JSON.stringify(result.data)}`);
}
const updateStacAPIEnvironmentVariables = async (): Promise<void> => {
	console.log(`stacServer.customResource> updateStacAPIEnvironmentVariables> in:`);
	const updateLambdaFutures = [STAC_API_LAMBDA, STAC_INGEST_LAMBDA].map(async (l: string) => {
		const currentFunctionConfiguration = await lambdaClient.send(new GetFunctionConfigurationCommand({ FunctionName: l }))
		// Trim the slash at the end of the string
		const formattedUrl = STAC_API_URL.endsWith('/') ? STAC_API_URL.replace(/\/$/, "") : STAC_API_URL;
		await lambdaClient.send(
			new UpdateFunctionConfigurationCommand({
				FunctionName: l,
				Environment: {
					Variables: {
						...currentFunctionConfiguration.Environment.Variables,
						STAC_API_URL: formattedUrl
					}
				}
			}),
		);
	})
	await Promise.all(updateLambdaFutures);
	console.log(`stacServer.customResource> updateStacAPIEnvironmentVariables> exit:`);
};


const createCollectionIndices = async (): Promise<void> => {
	console.log(`stacServer.customResource> createCollectionIndices> in:`);

	await lambdaClient.send(
		new InvokeCommand({
			FunctionName: STAC_INGEST_LAMBDA,
			InvocationType: 'RequestResponse',
			Payload: fromUtf8(JSON.stringify({ create_indices: true })),
		}),
	);

	const createdAt = new Date(Date.now()).toISOString();


	const constructCollection = (type: string) => {
		return {
			id: `arcade-${type}`,
			type: 'Collection',
			stac_version: '1.0.0',
			stac_extensions: [
				'https://stac-extensions.github.io/eo/v1.0.0/schema.json',
				'https://stac-extensions.github.io/projection/v1.0.0/schema.json',
				'https://stac-extensions.github.io/view/v1.0.0/schema.json',
			],
			description: `Collection contains all ${type}s in ARCADE framework.`,
			license: 'proprietary',
			extent: {
				spatial: {
					bbox: [],
				},
				temporal: {
					interval: [[createdAt, null]],
				},
			},
			links: [],
		}
	}


	await snsClient.send(
		new PublishCommand({
			Message: JSON.stringify(constructCollection('polygon')),
			TopicArn: INGESTION_TOPIC_ARN
		})
	);

	await snsClient.send(
		new PublishCommand({
			Message: JSON.stringify(constructCollection('polygon')),
			TopicArn: INGESTION_TOPIC_ARN
		})
	);

	console.log(`stacServer.customResource> createCollectionIndices> exit:`);
};

const getCredentials = async (secretName: string): Promise<Credentials> => {
	console.log(`stacServer.customResource> getCredentials> in: secretName: ${secretName}`);

	const masterCredentials = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: secretName }));

	console.log(`stacServer.customResource> getCredentials> exit:`);
	return JSON.parse(masterCredentials.SecretString);
}

const linkRoleToUser = async (roleName: string, stacUsername: string, credentials: Credentials): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchUser> in: roleName: ${roleName}, stacUsername: ${stacUsername}`);

	const payload = { users: [stacUsername] };

	const result = await axios.put(`https://${STAC_ENDPOINT}/_plugins/_security/api/rolesmapping/${roleName}` as string, payload, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: credentials.username,
			password: credentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchUser> exit> result: ${JSON.stringify(result.data)}`);
}

const createOpenSearchUser = async (userCredentials: Credentials, adminCredentials: Credentials): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchUser> in:`);

	const result = await axios.put(`https://${STAC_ENDPOINT}/_plugins/_security/api/internalusers/${userCredentials.username}` as string, { password: userCredentials.password }, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: adminCredentials.username,
			password: adminCredentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchUser> exit> result: ${JSON.stringify(result.data)}`);
}
const createOpenSearchRole = async (roleName: string, credentials: Credentials): Promise<void> => {
	console.log(`stacServer.customResource> createOpenSearchRole> in :`);

	const payload = {
		cluster_permissions: ['cluster_composite_ops', 'cluster:monitor/health'],
		index_permissions: [
			{
				index_patterns: ['*'],
				allowed_actions: ['indices_all'],
			},
		],
		tenant_permissions: [
			{
				tenant_patterns: ['global_tenant'],
				allowed_actions: ['kibana_all_read'],
			},
		],
	};

	const result = await axios.put(`https://${STAC_ENDPOINT}/_plugins/_security/api/roles/${roleName}` as string, payload, {
		headers: {
			'Content-Type': 'application/json',
		},
		auth: {
			username: credentials.username,
			password: credentials.password,
		},
	});

	console.log(`stacServer.customResource> createOpenSearchRole> exit> result: ${JSON.stringify(result.data)}`);
}

const init = async (): Promise<void> => {
	console.log(`stacServer.customResource> init> in :`);
	// get the credentials for admin and the created credentials for stac user (we're going to create the later in OpenSearch)
	const [credentials, userCredentials] = await Promise.all([getCredentials(ADMIN_SECRET_NAME), getCredentials(USER_SECRET_NAME)])
	// create the role and users that will be used by the ingestion lambda
	await createOpenSearchUser(userCredentials, credentials);
	await createOpenSearchRole(STAC_ROLE_NAME, credentials);
	await linkRoleToUser(STAC_ROLE_NAME, userCredentials.username, credentials);

	// create index for collection
	await createCollectionIndices();

	// create index for polygon and region resources
	await createIndices(credentials, 'arcade-polygon', polygonIndexMapping);
	await createIndices(credentials, 'arcade-region', regionIndexMapping);

	// update StacAPI lambda environment variables
	await updateStacAPIEnvironmentVariables();

	console.log(`stacServer.customResource> init> exit :`);
}

export const handler = async (event: CloudFormationCustomResourceEvent): Promise<any> => {
	console.log(`stacServer.customResource > handler > in : ${JSON.stringify(event)}`);
	try {
		switch (event.RequestType) {
			case "Create":
				await init();
				break;
			case "Update":
				//  the call to init() is idempotent
				await init();
				break;
			case "Delete":
				break;
		}
	} catch (e) {
		console.log(`stacServer.customResource > error : ${e}`);
	}

};

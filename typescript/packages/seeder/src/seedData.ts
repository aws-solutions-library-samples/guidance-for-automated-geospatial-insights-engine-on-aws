#!/usr/bin/env node
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
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// main
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
import * as fg from 'fast-glob';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import fs from "fs";
import axios from 'axios';
import { authorizeUser } from "./auth.js";


enum ResourceType {
	Group = 'groups',
	Region = 'regions',
	Polygon = 'polygons',
	State = 'states'
}

interface SeedEntry {
	context?: string;
	resourceType: ResourceType,
	resourceName: string;
	filePath: string;
}

interface ApiResponse {
	status: number;
	response: any;
}

const [environment, seedDir, username, password, operation] = process.argv.slice(2);

if (process.argv.length < 5) {
	throw new Error('Missing arguments\r\nHow to run the command: \r\n> npm run seed -- <environment> <seed directory> <username> <password> <operation (seed)> ');
}

console.log(`SIF Data Seeder`);

async function apiGet(url: string, path: string, authToken: string): Promise<ApiResponse> {
	try {
		const response = await axios.get(`${url}/${path}`, {
			headers: {
				'Accept-Version': '1.0.0',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authToken}`
			},
		});

		return {
			status: response.status,
			response: response.data
		};
	} catch (e) {
		if (axios.isAxiosError(e)) {
			if (e.response?.status === 404) {
				return ({ status: 404, response: 'NOT_FOUND' });
			} else if (e.response?.status === 409) {
				return ({ status: 409, response: 'RESOURCE_EXISTS' });
			}
		}

		console.error(e);
		throw new Error('GET API call failed');
	}
}

async function apiPost(url: string, path: string, authToken: string, data: string): Promise<ApiResponse> {
	try {
		const response = await axios.post(`${url}/${path}`, data, {
			headers: {
				'Accept-Version': '1.0.0',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authToken}`,
			},
		});

		return {
			status: response.status,
			response: JSON.stringify(response.data)
		};
	} catch (e) {
		if (axios.isAxiosError(e)) {
			if (e.response?.status === 409) {
				return ({ status: 409, response: 'RESOURCE_EXISTS' });
			}
		}

		console.error(e);
		throw new Error('POST API call failed');
	}
}

async function apiPatch(url: string, path: string, authToken: string, data: string): Promise<ApiResponse> {
	try {
		const response = await axios.patch(`${url}/${path}`, data, {
			headers: {
				'Accept-Version': '1.0.0',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${authToken}`,
			},
		});

		return {
			status: response.status,
			response: JSON.stringify(response.data)
		};
	} catch (e) {
		if (axios.isAxiosError(e)) {
			if (e.response?.status === 404) {
				return ({ status: 404, response: 'NOT_FOUND' });
			}
		}

		console.error(e);
		throw new Error('PATCH API call failed');
	}
}

async function apiDelete(url: string, path: string, groupContext: string, authToken: string): Promise<ApiResponse> {
	try {
		const response = await axios.delete(`${url}/${path}`, {
			headers: {
				'Accept-Version': '1.0.0',
				Authorization: `Bearer ${authToken}`,
				'x-groupcontextid': groupContext,
			},
		});

		return {
			status: response.status,
			response: JSON.stringify(response.data)
		};
	} catch (e) {
		if (axios.isAxiosError(e)) {
			if (e.response?.status === 404) {
				return ({ status: 404, response: 'NOT_FOUND' });
			}
		}

		console.error(e);
		throw new Error('DELETE API call failed');
	}
}

async function seedGroups(entries: SeedEntry[], endpoint: string, token: string): Promise<void> {
	const seedEntries = entries.filter(e => e.resourceType === 'groups');
	for (const se of seedEntries) {
		const groupDefinition = fs.readFileSync(se.filePath, 'utf-8');
		const groupDefinitionJson = JSON.parse(groupDefinition);
		const groupName = groupDefinitionJson.name;
		const getGroupByNameResponse = await apiGet(endpoint, `/groups?name=${groupName}`, token);
		if (getGroupByNameResponse.response.groups.length > 0) {
			const currentGroup = getGroupByNameResponse.response.groups[0];
			console.log(`Updating group ${groupName} with id ${currentGroup.id}`)
			await apiPatch(endpoint, `/groups/${currentGroup.id}`, token, groupDefinitionJson);
		} else {
			console.log(`Creating new group with name ${groupName}`)
			await apiPost(endpoint, `/groups`, token, groupDefinitionJson);
		}
	}
}

async function seedStates(entries: SeedEntry[], endpoint: string, token: string): Promise<void> {
	const seedEntries = entries.filter(e => e.resourceType === 'states');
	for (const se of seedEntries) {
		const stateDefinition = fs.readFileSync(se.filePath, 'utf-8');
		const stateDefinitionJson = JSON.parse(stateDefinition);
		stateDefinitionJson.timestamp = new Date().toISOString();
		stateDefinitionJson.tags.plantedAt = new Date().toISOString();
		const getPolygonByName = await apiGet(endpoint, `/polygons?name=${se.resourceName}`, token);
		const currentPolygon = getPolygonByName.response.polygons[0];
		console.log(`Creating state for polygon ${currentPolygon.name} with id ${currentPolygon.id}`)
		await apiPost(endpoint, `/polygons/${currentPolygon.id}/states`, token, stateDefinitionJson);
	}
}

async function seedRegions(entries: SeedEntry[], endpoint: string, token: string): Promise<void> {
	const seedEntries = entries.filter(e => e.resourceType === 'regions');
	for (const se of seedEntries) {
		const getParentResponse = await apiGet(endpoint, `/groups?name=${se.context}`, token);
		const groupId = getParentResponse.response.groups[0].id;
		const regionDefinition = fs.readFileSync(se.filePath, 'utf-8');
		const regionDefinitionJson = JSON.parse(regionDefinition);
		const regionName = regionDefinitionJson.name;
		const getRegionByNameResponse = await apiGet(endpoint, `/regions?name=${regionName}`, token);
		if (getRegionByNameResponse.response.regions.length > 0) {
			const currentRegion = getRegionByNameResponse.response.regions[0];
			console.log(`Updating region ${regionName} with id ${currentRegion.id}`)
			await apiPatch(endpoint, `/regions/${currentRegion.id}`, token, regionDefinitionJson);
		} else {
			console.log(`Creating new region with name ${regionName}`)
			await apiPost(endpoint, `/groups/${groupId}/regions`, token, regionDefinitionJson);
		}
	}
}

async function seedPolygons(entries: SeedEntry[], endpoint: string, token: string): Promise<void> {
	const seedEntries = entries.filter(e => e.resourceType === 'polygons');
	for (const se of seedEntries) {
		const getParentResponse = await apiGet(endpoint, `/regions?name=${se.context}`, token);
		const regionId = getParentResponse.response.regions[0].id;
		const polygonDefinition = fs.readFileSync(se.filePath, 'utf-8');
		const polygonDefinitionJson = JSON.parse(polygonDefinition);
		const polygonName = polygonDefinitionJson.name;
		const getPolygonByName = await apiGet(endpoint, `/polygons?name=${polygonName}`, token);
		if (getPolygonByName.response.polygons.length > 0) {
			const currentPolygon = getPolygonByName.response.polygons[0];
			console.log(`Updating polygon ${polygonName} with id ${currentPolygon.id}`)
			await apiPatch(endpoint, `/polygons/${currentPolygon.id}`, token, polygonDefinitionJson);
		} else {
			console.log(`Creating new region with name ${polygonName}`)
			await apiPost(endpoint, `/regions/${regionId}/polygons`, token, polygonDefinitionJson);
		}
	}
}

async function getSSMParameter(path: string, context: string): Promise<{
	context: string,
	value: string
}> {
	const ssm = new SSMClient({});
	const response = await ssm.send(
		new GetParameterCommand({
			Name: path,
		})
	);
	return {
		context,
		value: response.Parameter?.Value as string
	};
}

async function getApiEndpoints(environment: string): Promise<{
	[key: string]: string
}> {
	// Get the url for the api endpoints
	const regionsUrlPath = `/arcade/${environment}/regions/apiUrl`;
	const apiEndpointsPromises = await Promise.all([
		getSSMParameter(regionsUrlPath, 'regions'),
	]);

	const apiEndpoints: {
		[key: string]: string
	} = {};

	apiEndpointsPromises.forEach((e) => {
		apiEndpoints[e.context] = e.value.endsWith('/') ? e.value.slice(0, -1) : e.value;
	});

	return apiEndpoints;
}

async function listSeedEntries(path: string): Promise<SeedEntry[]> {
	const seedFiles = await fg.default([`**/*.json`], { cwd: path, absolute: false, objectMode: true });

	return seedFiles.map((sf) => {
		return {
			resourceType: sf.path.split('/')[0] as ResourceType,
			resourceName: sf.name.split('.')[0],	// myresource.json --> myresource
			context: parentResource(sf.path),
			filePath: `${path}/${sf.path}`
		};
	});
}

function parentResource(resourcePath: string): string {
	const tokens = resourcePath.split('/');
	return `${tokens.slice(1, tokens.length - 1).join('/')}`;
}

if (operation === 'seed') {
	(async () => {
		const seedEntries = await listSeedEntries(seedDir);
		const endPoints = await getApiEndpoints(environment);
		const [userPool, userClient] = await Promise.all([
			getSSMParameter(`/arcade/${environment}/shared/cognitoUserPoolId`, 'cognitoUserPoolId'),
			getSSMParameter(`/arcade/${environment}/shared/cognitoUserPoolClientId`, 'cognitoUserClientId'),
		]);
		process.env.COGNITO_USER_POOL_ID = userPool.value;
		process.env.COGNITO_CLIENT_ID = userClient.value;
		const token = await authorizeUser(username, password);
		console.log(`=========== Seeding groups ===========`);
		await seedGroups(seedEntries, endPoints['regions'], token);
		console.log(`=========== Seeding regions ===========`);
		await seedRegions(seedEntries, endPoints['regions'], token);
		console.log(`=========== Seeding polygons ===========`);
		await seedPolygons(seedEntries, endPoints['regions'], token);
		console.log(`=========== Seeding states ===========`);
		await seedStates(seedEntries, endPoints['regions'], token);
		console.log(`Done`);
	})();
}




import { EngineNew, EngineResource, EngineResourceList, EngineUpdate } from './schemas.js';

export const newEngineRequestExample: EngineNew = {
	name: 'sample-engine-processor',
	jobRoleArn: 'sample-role-arn',
	image: 'account.dkr.ecr.region.amazonaws.com/process-image:v1',
	memory: 2048,
	vcpus: 1,
	environment: {
		SENTINEL_COLLECTION: 'sentinel-2-c1-l2a',
	},
};

export const updateEngineRequestExample: EngineUpdate = {
	memory: 4096,
	vcpus: 2,
	environment: {
		SENTINEL_COLLECTION: 'sentinel-2-c1-l2a',
	},
};

export const engineExample: EngineResource = {
	...newEngineRequestExample,
	id: '01jbv38j4mkej1pysmcs1bsp6q',
	jobDefinitionArn: 'arn:aws:batch:region:account:job-definition/sample-engine-processor:1',
	createdAt: '2024-10-30T03:30:58.734Z',
	createdBy: 'someone@somewhere.com',
};

export const engineListExample: EngineResourceList = {
	engines: [engineExample],
};

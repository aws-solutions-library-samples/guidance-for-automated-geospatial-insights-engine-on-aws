export interface EngineResource {
	id: string;
	name: string;
	jobRoleArn: string;
	jobDefinitionArn: string;
	image: string;
	memory: number;
	vcpus: number;
}

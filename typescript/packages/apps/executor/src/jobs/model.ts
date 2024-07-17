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

import { ResultResource, State } from '@arcade/clients';
import { RegionResource } from '@arcade/events';

export type StartJobRequest = RegionResource & {
	scheduleDateTime: string
};

export type FinishJobRequest = {
	jobArn: string,
	status: string,
	statusReason: string,
	jobId: string
}

export interface BatchEngineInput {
	polygonId: string;
	polygonName: string;
	groupId: string;
	groupName: string;
	regionId: string;
	regionName: string;
	resultId: string;
	coordinates: [[[[number, number]]]],
	exclusions?: [[[number, number]]];
	scheduleDateTime: string;
	outputPrefix: string;
	state: State;
	latestSuccessfulResult?: ResultResource;
}

export interface AwsBatchJobStateChange {
	jobArn: string
	jobName: string
	jobId: string
	jobQueue: string
	status: string
	statusReason?: string;
	attempts: any[]
	createdAt: number
	retryStrategy: RetryStrategy
	dependsOn: any[]
	jobDefinition: string
	parameters: Parameters
	container: Container
	tags: Record<string, string>
	propagateTags: boolean
	platformCapabilities: any[]
}

export interface RetryStrategy {
	attempts: number
	evaluateOnExit: any[]
}

export interface Parameters {}

export interface Container {
	image: string
	command: string[]
	volumes: any[]
	environment: any[]
	mountPoints: any[]
	ulimits: any[]
	networkInterfaces: any[]
	resourceRequirements: ResourceRequirement[]
	secrets: any[]
}

export interface ResourceRequirement {
	value: string
	type: string
}

export interface Tags {
	resourceArn: string
}


export type JobQueueArn = string;

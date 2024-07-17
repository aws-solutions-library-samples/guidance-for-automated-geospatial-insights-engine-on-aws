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

export type Priority = 'low' | 'standard' | 'high';

export type Mode = 'scheduled' | 'disabled' | 'onNewScene';

export interface ProcessingConfig {
	mode: Mode,
	priority?: Priority,
	scheduleExpression?: string,
	scheduleExpressionTimezone?: string
}

export interface RegionResource {
	id: string;
	groupId: string;
	name: string;
	boundingBox: number[];
	processingConfig: ProcessingConfig
	tags?: Record<string, string>;
	attributes?: Record<string, string>;
	createdAt: string;
	createdBy: string;
	updatedAt?: string;
	updatedBy?: string;
}

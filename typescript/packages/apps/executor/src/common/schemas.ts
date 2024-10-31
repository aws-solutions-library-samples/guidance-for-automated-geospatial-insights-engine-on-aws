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

/* eslint-disable @rushstack/typedef-var */
import { Type } from '@sinclair/typebox';

export const regionId = Type.String({ description: 'Unique Region ID.' });

export const startDateTime = Type.String({ description: "The query window's start time." });

export const endDateTime = Type.String({ description: "The query window's end time" });

export type NextToken = string;

export type ListPaginationOptions = {
	count?: number;
	token?: NextToken;
};

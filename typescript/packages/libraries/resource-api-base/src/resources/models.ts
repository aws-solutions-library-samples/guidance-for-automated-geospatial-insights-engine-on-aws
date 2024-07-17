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

export interface Resource {
	id: string;
	keyPrefix: string;
	alternateId?: string;
}

export interface ListIdsPaginationTokenKey {
	paginationToken: string;
}

export interface ListIdsPaginationOptions {
	count?: number;
	from?: ListIdsPaginationKey;
}

export interface ListIdsPaginationKey {
	id: string;
	groupId?: string;
}

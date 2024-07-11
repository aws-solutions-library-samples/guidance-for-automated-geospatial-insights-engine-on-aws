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

export type AuthenticationType = 'token' | 'apiKey';

export const COMMON_HEADERS = (idToken: string | undefined) => {
	const common = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'Accept-Version': '1.0.0',
	};
	if (!idToken) return common;
	common['Authorization'] = `Bearer ${idToken}`;
	return common;
};

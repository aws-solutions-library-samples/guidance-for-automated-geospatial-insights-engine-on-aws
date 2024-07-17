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

import { MapAuthHelper, withIdentityPoolId } from '@aws/amazon-location-utilities-auth-helper';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useEffect, useRef, useState } from 'react';

const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const COGNITO_USER_POOL_REGION = import.meta.env.VITE_COGNITO_USER_POOL_REGION;
const UI_TILER_API_ENDPOINT = import.meta.env.VITE_UI_REST_API_URL;

export const useMapAuth = () => {
	const [authHelper, setAuthHelper] = useState<MapAuthHelper | null>(null);
	const authTokenRef = useRef<string>();

	const fetchToken = async () => {
		const token = (await fetchAuthSession()).tokens?.idToken?.toString();
		authTokenRef.current = token;
	};

	useEffect(() => {
		fetchToken();
	}, []);

	const transformRequest = (url: string, resourceType?: string) => {
		if ((resourceType === 'Source' || resourceType === 'Tile') && url.startsWith(UI_TILER_API_ENDPOINT) && authTokenRef.current) {
			return {
				url: url,
				headers: { Authorization: authTokenRef.current },
			};
		} else if (url.startsWith('https://maps.geo.')) {
			return authHelper!.getMapAuthenticationOptions().transformRequest(url, resourceType);
		}
		return { url };
	};
	useEffect(() => {
		const fetchData = async () => {
			const session = await fetchAuthSession();
			const token = session?.tokens?.idToken?.toString() || null;

			if (token) {
				const authHelper = await withIdentityPoolId(IDENTITY_POOL_ID, {
					logins: {
						[`cognito-idp.${COGNITO_USER_POOL_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`]: token,
					},
				});
				setAuthHelper(authHelper);
			}
		};
		fetchData();
	}, []);

	return authHelper ? transformRequest : undefined;
};

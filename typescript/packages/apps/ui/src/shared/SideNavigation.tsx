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

import SideNavigation from '@cloudscape-design/components/side-navigation';
import { useLocation, useNavigate } from 'react-router-dom';

export default () => {
	const navigate = useNavigate();
	const location = useLocation();
	const activeHref = location.pathname.match(/^\/(\w+)/)?.[1] || '';

	return (
		<SideNavigation
			activeHref={`/${activeHref}`}
			header={{ href: '/', text: 'AGIE' }}
			onFollow={(event) => {
				if (!event.detail.external) {
					event.preventDefault();
					navigate(event.detail.href);
				}
			}}
			items={[
				{ type: 'link', text: 'Growers', href: '/growers' },
				{ type: 'link', text: 'Farms', href: '/farms' },
				{ type: 'link', text: 'Fields', href: '/fields' },
				{ type: 'link', text: 'Analysis', href: '/analysis' },
				{ type: 'divider' },
				{
					type: 'link',
					text: 'Subscriptions',
					href: '/subscriptions',
				},
				{
					type: 'link',
					text: 'Documentation',
					href: 'https://example.com',
					external: true,
				},
			]}
		/>
	);
};

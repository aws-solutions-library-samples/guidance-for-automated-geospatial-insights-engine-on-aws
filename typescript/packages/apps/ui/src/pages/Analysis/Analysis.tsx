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

import { AppLayout, ContentLayout } from '@cloudscape-design/components';
import Header from '@cloudscape-design/components/header';
import 'maplibre-gl/dist/maplibre-gl.css';
import Breadcrumbs from '../../shared/Breadcrumbs';
import SideNavigation from '../../shared/SideNavigation';
import TopNavigation from '../../shared/TopNavigation';

import './Analysis.css';
import CloudscapeMap from './CloudscapeMap';

export default function Analysis() {
	return (
		<>
			<TopNavigation />
			<AppLayout
				toolsHide={true}
				breadcrumbs={<Breadcrumbs items={[{ text: 'Analysis', href: '/analysis' }]} />}
				navigation={<SideNavigation />}
				contentType="table"
				content={
					<ContentLayout
						header={
							<Header variant="h1" description={'Explore the map below.'}>
								Analysis
							</Header>
						}
					>
						<CloudscapeMap />
					</ContentLayout>
				}
			></AppLayout>
		</>
	);
}

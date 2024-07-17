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

import { AppLayout, AppLayoutProps } from '@cloudscape-design/components';
import SideNavigation from './SideNavigation';
import TopNavigation from './TopNavigation';

export interface ShellProps {
	breadcrumbs: AppLayoutProps['breadcrumbs'];
	contentType: AppLayoutProps['contentType'];
	content: AppLayoutProps['content'];
}
export default function Shell(props: ShellProps) {
	return (
		<>
			<TopNavigation />
			<AppLayout toolsHide={true} breadcrumbs={props.breadcrumbs} navigation={<SideNavigation />} contentType={props.contentType} content={props.content}></AppLayout>
		</>
	);
}

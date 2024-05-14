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

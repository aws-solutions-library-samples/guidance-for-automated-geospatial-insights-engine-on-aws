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

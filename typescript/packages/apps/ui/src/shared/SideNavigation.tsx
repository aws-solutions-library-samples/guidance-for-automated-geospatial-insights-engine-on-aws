import { Badge } from '@cloudscape-design/components';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import { useLocation, useNavigate } from 'react-router-dom';

export default () => {
	const navigate = useNavigate();
	const location = useLocation();
	return (
		<SideNavigation
			activeHref={location.pathname}
			header={{ href: '/', text: 'ARCADE' }}
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
					text: 'Notifications',
					href: '/notifications',
					info: <Badge color="red">2</Badge>,
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

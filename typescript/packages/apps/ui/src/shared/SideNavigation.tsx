import SideNavigation from '@cloudscape-design/components/side-navigation';
import { useLocation, useNavigate } from 'react-router-dom';

export default () => {
	const navigate = useNavigate();
	const location = useLocation();
	const activeHref = location.pathname.match(/^\/(\w+)/)?.[1] || '';

	return (
		<SideNavigation
			activeHref={`/${activeHref}`}
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

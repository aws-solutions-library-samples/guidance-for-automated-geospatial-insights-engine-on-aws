import { useAuthenticator } from '@aws-amplify/ui-react';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';

export default () => {
	const { user, signOut } = useAuthenticator((context) => [context.user]);
	const navigate = useNavigate();
	const i18nStrings = {
		searchIconAriaLabel: 'Search',
		searchDismissIconAriaLabel: 'Close search',
		overflowMenuTriggerText: 'More',
		overflowMenuTitleText: 'All',
		overflowMenuBackIconAriaLabel: 'Back',
		overflowMenuDismissIconAriaLabel: 'Close menu',
	};

	return (
		<TopNavigation
			i18nStrings={i18nStrings}
			identity={{
				href: '/',
				onFollow: (event) => {
					event.preventDefault();
					navigate('/');
				},
				title: 'Agricultural Root Cause Analysis and Decision Engine (ARCADE)',
				logo: {
					src: '/aws-logo-rgb-rev.svg',
					alt: 'AWS Logo',
				},
			}}
			utilities={[
				{
					type: 'button',
					iconName: 'notification',
					title: 'Notifications',
					href: '/notifications',
					onFollow: (event) => {
						event.preventDefault();
						navigate('/notifications');
					},
					ariaLabel: 'Notifications (unread)',
					badge: true,
					disableUtilityCollapse: false,
				},
				{
					type: 'menu-dropdown',
					text: user?.signInDetails?.loginId ?? 'User Details',
					iconName: 'user-profile',
					onItemClick: async (event) => {
						if (event.detail.id === 'signout') {
							signOut();
						} else if (event.detail.id === 'authToken') {
							const idToken = (await fetchAuthSession()).tokens?.idToken?.toString();
							navigator.clipboard.writeText(idToken ?? 'Copy Failed');
						}
					},
					items: [
						{ id: 'authToken', text: 'Copy Auth Token', iconName: 'copy' },
						{ id: 'signout', text: 'Sign out' },
					],
				},
			]}
		/>
	);
};

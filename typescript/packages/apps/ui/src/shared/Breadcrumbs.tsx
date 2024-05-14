import BreadcrumbGroup, { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import { useNavigate } from 'react-router-dom';

export default function ({ items }: { items: BreadcrumbGroupProps['items'] }) {
	const navigate = useNavigate();
	return (
		<BreadcrumbGroup
			onFollow={(event) => {
				event.preventDefault();
				navigate(event.detail.href);
			}}
			items={[{ text: 'ARCADE', href: '/' }, ...items]}
			ariaLabel="Breadcrumbs"
		/>
	);
}

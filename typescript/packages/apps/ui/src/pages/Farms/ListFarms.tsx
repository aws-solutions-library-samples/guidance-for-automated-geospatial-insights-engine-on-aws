import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import FarmsTable from './FarmsTable';

export default function ListFarms() {
	const { growerId } = useParams();
	const breadcrumbsItems = [{ text: 'Farms', href: '/farms' }];
	if (growerId) {
		breadcrumbsItems.unshift({ text: 'Growers', href: '/growers' }, { text: growerId, href: `/growers/${growerId}` });
	}

	return <Shell breadcrumbs={<Breadcrumbs items={breadcrumbsItems} />} contentType="table" content={<FarmsTable growerId={growerId} variant="full-page" />} />;
}

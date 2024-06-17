import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import FieldsTable from './FieldsTable';

export default function ListFields() {
	const { growerId, farmId } = useParams();

	return (
		<Shell
			breadcrumbs={<Breadcrumbs items={[{ text: 'Fields', href: '/fields' }]} />}
			contentType="table"
			content={<FieldsTable variant="full-page" farmId={farmId} growerId={growerId} />}
		/>
	);
}

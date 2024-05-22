import { StatusIndicator } from '@cloudscape-design/components';

export default function ({ status }: { status: 'succeeded' | 'failed' | string | undefined | null }) {
	switch (status) {
		case 'succeeded':
			return <StatusIndicator type="success">Succeeded</StatusIndicator>;
		case 'in-progress':
			return <StatusIndicator type="in-progress">In progress</StatusIndicator>;
		case 'pending':
			return <StatusIndicator type="pending">Pending</StatusIndicator>;
		case 'failed':
			return <StatusIndicator type="error">Failed</StatusIndicator>;
		default:
			return '-';
	}
}

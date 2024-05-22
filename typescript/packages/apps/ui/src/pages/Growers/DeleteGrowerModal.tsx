import { Group } from '@arcade/regions';
import { Alert, Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import { useDeleteGroupMutation } from '../../slices/regionsApiSlice';

export default function ({ visible, onCancel, onDeleteSuccessful, grower }: { visible: boolean; onCancel: () => void; onDeleteSuccessful: () => void; grower: Group }) {
	const [deleteGrower, response] = useDeleteGroupMutation();
	const onInitDelete = () => {
		deleteGrower(grower.id)
			.unwrap()
			.then(() => {
				onDeleteSuccessful();
			})
			.catch((reason) => {
				console.error(reason);
			});
	};
	return (
		<Modal
			visible={visible}
			onDismiss={onCancel}
			header={'Delete grower'}
			closeAriaLabel="Close dialog"
			footer={
				<Box float="right">
					<SpaceBetween direction="horizontal" size="xs">
						<Button variant="link" onClick={onCancel}>
							Cancel
						</Button>
						<Button variant="primary" onClick={onInitDelete} loading={response.isLoading} data-testid="submit">
							Delete
						</Button>
					</SpaceBetween>
				</Box>
			}
		>
			{grower && (
				<SpaceBetween size="m">
					<Box variant="span">
						Permanently delete grower{' '}
						<Box variant="span" fontWeight="bold">
							{grower.name}
						</Box>
						? You can’t undo this action.
					</Box>

					<Alert statusIconAriaLabel="Info">Proceeding with this action will delete the grower and can affect related resources.</Alert>
				</SpaceBetween>
			)}
		</Modal>
	);
}

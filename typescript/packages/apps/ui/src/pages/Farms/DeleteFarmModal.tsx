import { Region } from '@arcade/regions';
import { Alert, Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import { useDeleteRegionMutation } from '../../slices/regionsApiSlice';

export default function ({ visible, onCancel, onDeleteSuccessful, farm }: { visible: boolean; onCancel: () => void; onDeleteSuccessful: () => void; farm: Region }) {
	const [deleteGrower, response] = useDeleteRegionMutation();
	const onInitDelete = () => {
		deleteGrower(farm.id)
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
			header={'Delete farm'}
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
			{farm && (
				<SpaceBetween size="m">
					<Box variant="span">
						Permanently delete farm{' '}
						<Box variant="span" fontWeight="bold">
							{farm.name}
						</Box>
						? You can’t undo this action.
					</Box>

					<Alert statusIconAriaLabel="Info">Proceeding with this action will delete the farm and can affect related resources.</Alert>
				</SpaceBetween>
			)}
		</Modal>
	);
}

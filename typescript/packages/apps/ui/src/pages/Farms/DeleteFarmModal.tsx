/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Region } from '@agie/regions';
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

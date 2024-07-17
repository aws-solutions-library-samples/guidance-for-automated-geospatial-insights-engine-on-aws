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

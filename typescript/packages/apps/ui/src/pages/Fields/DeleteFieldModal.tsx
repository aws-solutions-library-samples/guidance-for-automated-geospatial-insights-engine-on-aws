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

import { Polygon } from '@arcade/regions';
import { Alert, Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import { useDeletePolygonMutation } from '../../slices/regionsApiSlice';

export default function({ visible, onCancel, onDeleteSuccessful, field }: { visible: boolean; onCancel: () => void; onDeleteSuccessful: () => void; field: Polygon }) {
	const [deleteField, response] = useDeletePolygonMutation();
	const onInitDelete = () => {
		deleteField(field.id)
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
			header={'Delete field'}
			closeAriaLabel='Close dialog'
			footer={
				<Box float='right'>
					<SpaceBetween direction='horizontal' size='xs'>
						<Button variant='link' onClick={onCancel}>
							Cancel
						</Button>
						<Button variant='primary' onClick={onInitDelete} loading={response.isLoading} data-testid='submit'>
							Delete
						</Button>
					</SpaceBetween>
				</Box>
			}
		>
			{field && (
				<SpaceBetween size='m'>
					<Box variant='span'>
						Permanently delete field{' '}
						<Box variant='span' fontWeight='bold'>
							{field.name}
						</Box>
						? You can’t undo this action.
					</Box>

					<Alert statusIconAriaLabel='Info'>Proceeding with this action will delete the field and can affect related resources.</Alert>
				</SpaceBetween>
			)}
		</Modal>
	);
}

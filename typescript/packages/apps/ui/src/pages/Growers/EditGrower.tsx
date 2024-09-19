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

import { EditGroup } from '@agie/regions';
import { Button, Container, ContentLayout, Form, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetGroupQuery, useUpdateGroupMutation } from '../../slices/regionsApiSlice';

export default function EditGrower() {
	const navigate = useNavigate();
	const { id: growerId } = useParams();
	const { data: grower } = useGetGroupQuery(growerId!);
	const [updateGroup, result] = useUpdateGroupMutation();
	const [updatedGrower, setUpdatedGrower] = useState<EditGroup>({ name: grower!.name });
	const onChange = (attribute: string, value: string) => {
		setUpdatedGrower((prevState) => {
			return {
				...prevState,
				[attribute]: value,
			};
		});
	};
	const handleSubmit = () => {
		updateGroup({ id: growerId!, body: updatedGrower })
			.unwrap()
			.then((result) => {
				navigate(`/growers/${result.id}`);
			})
			.catch((reason) => {
				console.error(reason);
			});
	};
	return (
		<Shell
			breadcrumbs={
				<Breadcrumbs
					items={[
						{ text: 'Growers', href: '/growers' },
						{ text: 'Create grower', href: `/growers/create` },
					]}
				/>
			}
			contentType="form"
			content={
				<ContentLayout header={<Header variant="h1">Create grower</Header>}>
					<form onSubmit={(event) => event.preventDefault()}>
						<Form
							actions={
								<SpaceBetween direction="horizontal" size="xs">
									<Button
										variant="link"
										onClick={() => {
											navigate(-1);
										}}
									>
										Cancel
									</Button>
									<Button data-testid="create" variant="primary" loading={result.isLoading} onClick={handleSubmit}>
										Update grower
									</Button>
								</SpaceBetween>
							}
							// errorText={'Error creating the grower'}
							errorIconAriaLabel="Error"
						>
							{
								<SpaceBetween size="l">
									<Container header={<Header variant="h2">Details</Header>}>
										<SpaceBetween size="l">
											<FormField label="Name" description="Enter the name of the grower.">
												{updatedGrower.name && (
													<Input value={updatedGrower.name} ariaRequired={true} onChange={({ detail: { value } }) => onChange('name', value)} />
												)}
											</FormField>
										</SpaceBetween>
									</Container>
								</SpaceBetween>
							}
						</Form>
					</form>
				</ContentLayout>
			}
		/>
	);
}

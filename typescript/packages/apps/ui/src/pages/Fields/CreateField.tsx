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

import { CreatePolygon } from '@arcade/regions';
import { Button, Container, ContentLayout, Form, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useCreatePolygonMutation } from '../../slices/regionsApiSlice';

export default function CreateField() {
	const { farmId } = useParams();
	const defaultField: CreatePolygon = {
		name: '',
		boundary: []
	};
	const navigate = useNavigate();
	const [createPolygon, result] = useCreatePolygonMutation();
	const [field, setField] = useState(defaultField);
	const onChange = (attribute: string, value: any) => {
		setField((prevState) => {
			let attributeValue = value;
			if (attribute === 'boundary') {
				try {
					attributeValue = JSON.parse(value);
				} catch (e) {
				}
			}
			return {
				...prevState,
				[attribute]: attributeValue
			};
		});
	};

	const handleSubmit = () => {
		createPolygon({ regionId: farmId!, body: field })
			.unwrap()
			.then((result) => {
				navigate(`/fields/${result.id}`);
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
						{ text: 'Farms', href: '/farms' },
						{ text: farmId!, href: `/farms/${farmId}` },
						{ text: 'Fields', href: `/farms/${farmId}/fields` },
						{ text: 'Create field', href: `/fields/create` }
					]}
				/>
			}
			contentType='form'
			content={
				<ContentLayout header={<Header variant='h1'>Create farm</Header>}>
					<form onSubmit={(event) => event.preventDefault()}>
						<Form
							actions={
								<SpaceBetween direction='horizontal' size='xs'>
									<Button
										variant='link'
										onClick={() => {
											navigate(`/farms/${farmId}`);
										}}
									>
										Cancel
									</Button>
									<Button data-testid='create' variant='primary' loading={result.isLoading} onClick={handleSubmit}>
										Create field
									</Button>
								</SpaceBetween>
							}
							errorIconAriaLabel='Error'
						>
							{
								<SpaceBetween size='l'>
									<Container header={<Header variant='h2'>Details</Header>}>
										<SpaceBetween size='l'>
											<FormField label='Farm ID' description='Enter the id of the farm.'>
												<Input disabled value={farmId!} ariaRequired={true} />
											</FormField>
											<FormField label='Name' description='Enter the name of the field.'>
												<Input value={field.name} ariaRequired={true} onChange={({ detail: { value } }) => onChange('name', value)} />
											</FormField>
											<FormField label='Name' description='Enter the bounday of the field in multipolygon format.'>
												<Input
													value={field.boundary.toString()}
													ariaRequired={true}
													onChange={({ detail: { value } }) => onChange('boundary', value)}
												/>
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

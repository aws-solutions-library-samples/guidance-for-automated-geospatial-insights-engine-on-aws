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

import { Button, Container, ContentLayout, Form, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useCreateGroupMutation } from '../../slices/regionsApiSlice';

const defaultGrower = {
	name: '',
};
export default function CreateGrower() {
	const navigate = useNavigate();
	const [createGroup, result] = useCreateGroupMutation();
	const [grower, setGrower] = useState(defaultGrower);
	const onChange = (attribute: string, value: string) => {
		setGrower((prevState) => {
			return {
				...prevState,
				[attribute]: value,
			};
		});
	};
	const handleSubmit = () => {
		createGroup(grower)
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
										Create grower
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
											<FormField
												label="Name"
												description="Enter the name of the grower."
												//   errorText={getErrorText('You must specify a root object.')}
												//   i18nStrings={{ errorIconAriaLabel: 'Error' }}
											>
												<Input value={grower.name} ariaRequired={true} onChange={({ detail: { value } }) => onChange('name', value)} />
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

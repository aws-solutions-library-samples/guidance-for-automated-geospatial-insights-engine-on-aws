import { EditGroup } from '@arcade/regions';
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

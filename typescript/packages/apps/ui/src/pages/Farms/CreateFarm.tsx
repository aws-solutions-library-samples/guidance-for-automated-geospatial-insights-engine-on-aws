import { CreateRegion } from '@arcade/regions';
import { Button, Container, ContentLayout, Form, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useCreateRegionMutation } from '../../slices/regionsApiSlice';

const defaultFarm: CreateRegion = {
	name: '',
	processingConfig: {
		mode: 'scheduled',
		// scheduleExpression,
		// scheduleExpressionTimezone
		priority: 'standard',
	},
};
export default function CreateFarm() {
	const navigate = useNavigate();
	const [createRegion, result] = useCreateRegionMutation();
	const [farm, setFarm] = useState(defaultFarm);
	const onChange = (attribute: string, value: any) => {
		setFarm((prevState) => {
			return {
				...prevState,
				[attribute]: value,
			};
		});
	};
	const handleSubmit = () => {
		createRegion(farm)
			.unwrap()
			.then((result) => {
				navigate(`/farms/${result.id}`);
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
						{ text: 'Create farm', href: `/farms/create` },
					]}
				/>
			}
			contentType="form"
			content={
				<ContentLayout header={<Header variant="h1">Create farm</Header>}>
					<form onSubmit={(event) => event.preventDefault()}>
						<Form
							actions={
								<SpaceBetween direction="horizontal" size="xs">
									<Button variant="link" onClick={() => {}}>
										Cancel
									</Button>
									<Button data-testid="create" variant="primary" loading={result.isLoading} onClick={handleSubmit}>
										Create farm
									</Button>
								</SpaceBetween>
							}
							// errorText={'Error creating the farm'}
							errorIconAriaLabel="Error"
						>
							{
								<SpaceBetween size="l">
									<Container header={<Header variant="h2">Details</Header>}>
										<SpaceBetween size="l">
											<FormField
												label="Name"
												description="Enter the name of the farm."
												//   errorText={getErrorText('You must specify a root object.')}
												//   i18nStrings={{ errorIconAriaLabel: 'Error' }}
											>
												<Input
													value={farm.name}
													ariaRequired={true}
													// placeholder="G"
													onChange={({ detail: { value } }) => onChange('name', value)}
												/>
											</FormField>
										</SpaceBetween>
									</Container>
									<Container header={<Header variant="h2">Field Analysis</Header>}>
										<SpaceBetween size="l">
											<FormField
												label="Name"
												description="Enter the name of the farm."
												//   errorText={getErrorText('You must specify a root object.')}
												//   i18nStrings={{ errorIconAriaLabel: 'Error' }}
											>
												<Input
													value={farm.name}
													ariaRequired={true}
													// placeholder="G"
													onChange={({ detail: { value } }) => onChange('name', value)}
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

import { CreateRegion } from '@arcade/regions';
import { Button, Container, ContentLayout, Form, FormField, Header, Input, Select, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useCreateRegionMutation } from '../../slices/regionsApiSlice';
interface ChangeSelectEventDetail {
	selectedOption: any;
}

export default function CreateFarm() {
	const { growerId } = useParams();
	const defaultFarm: CreateRegion = {
		name: '',
		processingConfig: {
			mode: 'scheduled',
			scheduleExpression: 'rate(5 days)',
			priority: 'standard',
		},
	};
	const navigate = useNavigate();
	const [createRegion, result] = useCreateRegionMutation();
	const [farm, setFarm] = useState(defaultFarm);
	const [selectedOption, setSelectedOption] = useState({ label: 'Standard', value: 'standard' });
	const onChange = (attribute: string, value: any) => {
		setFarm((prevState) => {
			return {
				...prevState,
				[attribute]: value,
			};
		});
	};
	const onChangeProcessingConfig = (attribute: string, value: any) => {
		setFarm((prevState) => {
			return {
				...prevState,
				processingConfig: {
					...prevState.processingConfig,
					[attribute]: value,
				},
			};
		});
	};
	const handleSubmit = () => {
		createRegion({ groupId: growerId!, body: farm })
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
						{ text: 'Growers', href: '/growers' },
						{ text: growerId!, href: `/growers/${growerId}` },
						{ text: 'Farms', href: `/growers/${growerId}/farms` },
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
							errorIconAriaLabel="Error"
						>
							{
								<SpaceBetween size="l">
									<Container header={<Header variant="h2">Details</Header>}>
										<SpaceBetween size="l">
											<FormField label="Grower ID" description="Enter the id of the grower.">
												<Input disabled value={growerId!} ariaRequired={true} />
											</FormField>
											<FormField label="Name" description="Enter the name of the farm.">
												<Input value={farm.name} ariaRequired={true} onChange={({ detail: { value } }) => onChange('name', value)} />
											</FormField>
										</SpaceBetween>
									</Container>
									<Container header={<Header variant="h2">Field Analysis</Header>}>
										<SpaceBetween size="l" direction="horizontal">
											<FormField label="Priority" description="Priority for performing the field analysis.">
												<Select
													selectedOption={selectedOption}
													onChange={({ detail }: { detail: ChangeSelectEventDetail }) => setSelectedOption(detail.selectedOption)}
													options={[
														{ label: 'Low', value: 'low' },
														{ label: 'Standard', value: 'standard' },
														{ label: 'High', value: 'high' },
													]}
												/>
											</FormField>
											<FormField label="Schedule expression" description="Enter the schedule expression for processing.">
												<Input
													value={farm.processingConfig.scheduleExpression ?? ''}
													ariaRequired={true}
													onChange={({ detail: { value } }) => onChangeProcessingConfig('scheduleExpression', value)}
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

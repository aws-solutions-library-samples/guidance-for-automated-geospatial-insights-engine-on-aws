import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, Link, SpaceBetween, StatusIndicator, Table } from '@cloudscape-design/components';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetGroupQuery } from '../../slices/regionsApiSlice';

export default function ViewGrower() {
	const { id } = useParams();
	const { data: grower } = useGetGroupQuery(id!);
	return (
		<Shell
			breadcrumbs={
				<Breadcrumbs
					items={[
						{ text: 'Growers', href: '/growers' },
						{ text: id!, href: `/growers/${id}` },
					]}
				/>
			}
			contentType="table"
			content={
				<ContentLayout
					header={
						grower && (
							<Header
								variant="h1"
								actions={
									<SpaceBetween direction="horizontal" size="xs">
										<Button>Edit</Button>
										<Button>Delete</Button>
									</SpaceBetween>
								}
							>
								{grower.name}
							</Header>
						)
					}
				>
					<SpaceBetween direction="vertical" size="l">
						<Container header={<Header variant="h2">Details</Header>}>
							{grower && (
								<ColumnLayout columns={2} variant="text-grid">
									<SpaceBetween direction="vertical" size="l">
										<div>
											<Box variant="awsui-key-label">Name</Box>
											<div>{grower!.name}</div>
										</div>
										<div>
											<Box variant="awsui-key-label">ID</Box>
											<CopyToClipboard
												variant="inline"
												textToCopy={grower!.id}
												copyButtonAriaLabel="Copy ID"
												copySuccessText="ID copied"
												copyErrorText="ID failed to copy"
											/>
										</div>
									</SpaceBetween>
									<SpaceBetween direction="vertical" size="l">
										<div>
											<Box variant="awsui-key-label">No. of Farms</Box>
											<div>10</div>
										</div>
									</SpaceBetween>
								</ColumnLayout>
							)}
						</Container>
						<Container header={<Header variant="h2">Farms</Header>}>
							<Table
								variant="embedded"
								items={[
									{
										name: 'Farm 1',
										acres: '100',
										noFields: '10',
										analysis: 'success',
										lastAnalysis: '2024-05-13T20:02:07.933Z',
									},
								]}
								columnDefinitions={[
									{ header: 'Name', cell: (item) => item.name },
									{ header: 'Acres', cell: (item) => item.acres },
									{ header: 'No. Fields', cell: (item) => item.noFields },
									{ header: 'Analysis', cell: () => <StatusIndicator>Success</StatusIndicator> },
									{
										header: 'Last analysis',
										cell: (item) => {
											return <Link variant="primary">{new Date(item.lastAnalysis).toLocaleString()}</Link>;
										},
									},
								]}
							/>
						</Container>
					</SpaceBetween>
				</ContentLayout>
			}
		/>
	);
}

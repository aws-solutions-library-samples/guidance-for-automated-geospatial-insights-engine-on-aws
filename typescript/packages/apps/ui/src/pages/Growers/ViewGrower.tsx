import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, Link, SpaceBetween } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetGroupQuery } from '../../slices/regionsApiSlice';
import FarmsTable from '../Farms/FarmsTable';
import DeleteGrowerModal from './DeleteGrowerModal';

export default function ViewGrower() {
	const navigate = useNavigate();
	const { id: growerId } = useParams();
	const { data: grower } = useGetGroupQuery(growerId!);
	const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

	return (
		<>
			<Shell
				breadcrumbs={
					<Breadcrumbs
						items={[
							{ text: 'Growers', href: '/growers' },
							{ text: growerId!, href: `/growers/${growerId}` },
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
											<Button onClick={() => navigate(`/growers/${growerId}/edit`)}>Edit</Button>
											<Button
												onClick={() => {
													setShowDeleteModal(true);
												}}
											>
												Delete
											</Button>
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
												<Box variant="awsui-key-label">No. Farms</Box>
												<div>
													{grower.totalRegions ? (
														<Link variant="primary" onFollow={() => navigate(`/farms?growerId=${grower!.id}`)}>
															{grower.totalRegions}
														</Link>
													) : (
														'-'
													)}
												</div>
											</div>
										</SpaceBetween>
									</ColumnLayout>
								)}
							</Container>
							<FarmsTable growerId={growerId} variant="container" />
						</SpaceBetween>
					</ContentLayout>
				}
			/>
			{grower && growerId && (
				<DeleteGrowerModal
					visible={showDeleteModal}
					onCancel={() => setShowDeleteModal(false)}
					onDeleteSuccessful={() => {
						setShowDeleteModal(false);
						navigate('/growers');
					}}
					grower={grower!}
				/>
			)}
		</>
	);
}

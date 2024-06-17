import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, Link, SpaceBetween } from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetRegionQuery } from '../../slices/regionsApiSlice';
import FieldsTable from '../Fields/FieldsTable';

export default function ViewFarm() {
	const navigate = useNavigate();
	const { id } = useParams();
	const { data: farm } = useGetRegionQuery(id!);
	return (
		<Shell
			breadcrumbs={
				<Breadcrumbs
					items={[
						{ text: 'Farms', href: '/farms' },
						{ text: id!, href: `/farms/${id}` },
					]}
				/>
			}
			contentType="table"
			content={
				<ContentLayout
					header={
						farm && (
							<Header
								variant="h1"
								actions={
									<SpaceBetween direction="horizontal" size="xs">
										<Button>Edit</Button>
										<Button>Delete</Button>
									</SpaceBetween>
								}
							>
								{farm.name}
							</Header>
						)
					}
				>
					<SpaceBetween direction="vertical" size="l">
						<Container header={<Header variant="h2">Details</Header>}>
							{farm && (
								<ColumnLayout columns={2} variant="text-grid">
									<SpaceBetween direction="vertical" size="l">
										<div>
											<Box variant="awsui-key-label">Name</Box>
											<div>{farm!.name}</div>
										</div>
										<div>
											<Box variant="awsui-key-label">ID</Box>
											<CopyToClipboard
												variant="inline"
												textToCopy={farm!.id}
												copyButtonAriaLabel="Copy ID"
												copySuccessText="ID copied"
												copyErrorText="ID failed to copy"
											/>
										</div>
									</SpaceBetween>
									<SpaceBetween direction="vertical" size="l">
										<div>
											<Box variant="awsui-key-label">No. Fields</Box>
											<div>
												{farm.totalPolygons ? (
													<Link variant="primary" onFollow={() => navigate(`/fields?farmId=${farm!.id}`)}>
														{farm.totalPolygons}
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
						{farm && <FieldsTable variant="container" farmId={farm?.id} growerId={farm?.groupId} />}
					</SpaceBetween>
				</ContentLayout>
			}
		/>
	);
}

import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, Link, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetRegionQuery, useListPolygonsQuery } from '../../slices/regionsApiSlice';

export default function ViewFarm() {
	const navigate = useNavigate();
	const { id } = useParams();
	const { data: farm } = useGetRegionQuery(id!);
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { polygons: [] }, isFetching } = useListPolygonsQuery({ regionId: id, count: apiPageSize, paginationToken: apiPaginationToken, includeLatestState: true });
	const { currentPage, maxKnownPage, handlePageChange, openEnd, items } = usePagination({
		apiPageSize,
		responsePageSize: 10,
		data: data.polygons,
		setApiPaginationToken,
		apiPaginationResponse: data.pagination,
	});
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
											<Box variant="awsui-key-label">No. Farms</Box>
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
						<Table
							header={<Header variant="h2">Fields</Header>}
							variant="container"
							pagination={
								<Pagination
									currentPageIndex={currentPage}
									pagesCount={maxKnownPage}
									openEnd={openEnd}
									onChange={(event) => {
										handlePageChange(event.detail.currentPageIndex);
									}}
								/>
							}
							loading={isFetching}
							loadingText="Loading fields for this farm"
							items={items}
							columnDefinitions={[
								{
									id: 'name',
									header: 'Name',
									cell: (item) => <Link onFollow={() => navigate(`/fields/${item.id}`)}>{item.name}</Link>,
									isRowHeader: true,
								},
								{
									id: 'acres',
									header: 'Acres',
									cell: (item) => (item.area ? item.area.toFixed(2) : '-'),
								},
								{
									id: 'crop',
									header: 'Crop',
									cell: (item) => (item.state?.tags?.crop ? item.state?.tags?.crop : '-'),
								},
								{
									id: 'plantedAt',
									header: 'Planted At',
									cell: (item) => (item.state?.tags?.plantedAt ? new Date(item.state?.tags?.plantedAt).toDateString() : '-'),
								},
								{
									id: 'harvestedAt',
									header: 'Harvested At',
									cell: (item) => (item.state?.tags?.harvestedAt ? new Date(item.state?.tags?.harvestedAt).toDateString() : '-'),
								},
							]}
						/>
					</SpaceBetween>
				</ContentLayout>
			}
		/>
	);
}

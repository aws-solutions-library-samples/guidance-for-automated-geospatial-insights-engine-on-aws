import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, Link, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetGroupQuery, useListRegionsQuery } from '../../slices/regionsApiSlice';
import ProcessingStatus from '../Farms/ProcessingStatus';

export default function ViewGrower() {
	const navigate = useNavigate();
	const { id: growerId } = useParams();
	const { data: grower } = useGetGroupQuery(growerId!);
	// const [searchParams, setSearchParams] = useSearchParams();

	// List farms for grower
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { regions: [] }, isFetching } = useListRegionsQuery({ groupId: growerId, count: apiPageSize, paginationToken: apiPaginationToken });
	const { currentPage, maxKnownPage, handlePageChange, openEnd, items } = usePagination({
		apiPageSize,
		responsePageSize: 10,
		data: data.regions,
		setApiPaginationToken,
		apiPaginationResponse: data.pagination,
	});
	// const [selectedItems, setSelectedItems] = useState<Region[]>([]);
	return (
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
						<Table
							header={<Header variant="h2">Farms</Header>}
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
							items={items}
							// selectedItems={selectedItems}
							selectionType="single"
							loading={isFetching}
							loadingText="Loading farms for this grower"
							empty={
								<Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
									<SpaceBetween size="m">
										<b>No farms for this grower</b>
										<Button>Create farm</Button>
									</SpaceBetween>
								</Box>
							}
							columnDefinitions={[
								{ header: 'Name', cell: (item) => <Link onFollow={() => navigate(`/farms/${item.id}`)}>{item.name}</Link> },
								{ header: 'Acres', cell: (item) => (item.totalArea ? item.totalArea.toFixed(2) : '-') },
								{ header: 'No. Fields', cell: (item) => item.totalPolygons ?? '-' },
								{
									header: 'Analysis',
									cell: (item) => <ProcessingStatus status={item.tags && item.tags['arcade:results:status'] ? item.tags['arcade:results:status'] : undefined} />,
								},
								{
									header: 'Last analysis',
									cell: (item) => (item.tags && item.tags['arcade:results:updatedAt'] ? new Date(item.tags['arcade:results:updatedAt']).toDateString() : '-'),
								},
							]}
						/>
					</SpaceBetween>
				</ContentLayout>
			}
		/>
	);
}

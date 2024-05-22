import { Group } from '@arcade/regions';
import { Button, Header, Link, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useListGroupsQuery } from '../../slices/regionsApiSlice';
import DeleteGrowerModal from './DeleteGrowerModal';

export default function ListGrowers() {
	const navigate = useNavigate();
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { groups: [] }, isFetching, refetch } = useListGroupsQuery({ count: apiPageSize, paginationToken: apiPaginationToken });
	const { currentPage, maxKnownPage, handlePageChange, openEnd, items } = usePagination({
		apiPageSize,
		responsePageSize: 10,
		data: data.groups,
		setApiPaginationToken,
		apiPaginationResponse: data.pagination,
	});
	const [selectedItems, setSelectedItems] = useState<Group[]>([]);
	const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
	return (
		<>
			<Shell
				breadcrumbs={<Breadcrumbs items={[{ text: 'Growers', href: '/growers' }]} />}
				contentType="table"
				content={
					<Table
						variant="full-page"
						selectionType="single"
						sortingDisabled
						selectedItems={selectedItems}
						onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
						loading={isFetching}
						header={
							<Header
								variant="awsui-h1-sticky"
								actions={
									<SpaceBetween direction="horizontal" size="xs">
										<Button variant="icon" iconName="refresh" onClick={refetch} />
										<Button disabled={!selectedItems.length} onClick={() => navigate(`/growers/${selectedItems[0].id}`)}>
											View details
										</Button>
										<Button disabled={!selectedItems.length} onClick={() => navigate(`/growers/${selectedItems[0].id}/edit`)}>
											Edit
										</Button>
										<Button
											disabled={!selectedItems.length}
											onClick={() => {
												setShowDeleteModal(true);
											}}
										>
											Delete
										</Button>
										<Button variant="primary" onClick={() => navigate(`/growers/create`)}>
											Create Grower
										</Button>
									</SpaceBetween>
								}
								description="A grower is the owner of one or more farms."
							>
								Growers
							</Header>
						}
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
						columnDefinitions={[
							{
								id: 'name',
								header: 'Name',
								cell: (item) => <Link onFollow={() => navigate(`/growers/${item.id}`)}>{item.name}</Link>,
								sortingField: 'name',
								isRowHeader: true,
							},
							{
								id: 'acres',
								header: 'Acres',
								cell: (item) => (item.totalArea ? item.totalArea.toFixed(2) : '-'),
							},
							{
								id: 'noFarms',
								header: 'No. Farms',
								cell: (item) => item.totalRegions ?? '-',
							},
						]}
					/>
				}
			/>
			{selectedItems[0]?.id && (
				<DeleteGrowerModal
					visible={showDeleteModal}
					onCancel={() => setShowDeleteModal(false)}
					onDeleteSuccessful={() => {
						setSelectedItems([]);
						setShowDeleteModal(false);
					}}
					grower={selectedItems[0]}
				/>
			)}
		</>
	);
}

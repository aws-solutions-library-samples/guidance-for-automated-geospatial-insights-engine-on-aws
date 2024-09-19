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

import { Region } from '@agie/regions';
import { Box, Button, Header, Link, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import { useListRegionsQuery } from '../../slices/regionsApiSlice';
import DeleteFarmModal from './DeleteFarmModal';
import ProcessingStatus from './ProcessingStatus';

export default function FarmsTable({ growerId, variant }: { growerId?: string; variant: 'container' | 'full-page' }) {
	const navigate = useNavigate();
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const {
		data = { regions: [] },
		isFetching,
		refetch,
	} = useListRegionsQuery({
		groupId: growerId ?? undefined,
		count: apiPageSize,
		paginationToken: apiPaginationToken,
	});
	const { currentPage, maxKnownPage, handlePageChange, openEnd, items } = usePagination({
		apiPageSize,
		responsePageSize: 10,
		data: data.regions,
		setApiPaginationToken,
		apiPaginationResponse: data.pagination,
	});
	const [selectedItems, setSelectedItems] = useState<Region[]>([]);
	const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

	return (
		<>
			<Table
				variant={variant}
				selectionType="single"
				sortingDisabled
				selectedItems={selectedItems}
				onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
				loading={isFetching}
				header={
					<Header
						variant={variant === 'full-page' ? 'awsui-h1-sticky' : 'h2'}
						actions={
							<SpaceBetween direction="horizontal" size="xs">
								<Button variant="icon" iconName="refresh" onClick={refetch}/>

								<Button disabled={!selectedItems.length} onClick={() => navigate(`/farms/${selectedItems[0].id}`)}>
									View details
								</Button>
								<Button disabled={!selectedItems.length} onClick={() => navigate(`/farms/${selectedItems[0].id}/edit`)}>
									Edit
								</Button>
								<Button
									onClick={() => {
										setShowDeleteModal(true);
									}}
									disabled={!selectedItems.length}
								>
									Delete
								</Button>
								{growerId && <Button onClick={() => navigate(`/growers/${growerId}/farms/create`)}>Create Farm</Button>}
							</SpaceBetween>
						}
						description="A farm is comprised of multiple fields and owned by a single grower."
					>
						Farms
					</Header>
				}
				empty={
					<Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
						{growerId ? (
							<SpaceBetween size="m">
								<b>No farms for this grower</b>
								<Button>Create farm</Button>
							</SpaceBetween>
						) : (
							<SpaceBetween size="m">
								<b>No farms</b>
							</SpaceBetween>
						)}
					</Box>
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
						cell: (item) => <Link onFollow={() => navigate(`/farms/${item.id}`)}>{item.name}</Link>,
						isRowHeader: true,
					},
					{
						id: 'acres',
						header: 'Acres',
						cell: (item) => (item.totalArea ? item.totalArea.toFixed(2) : '-'),
					},
					{
						id: 'noFields',
						header: 'No. Fields',
						cell: (item) => item.totalPolygons ?? '-',
					},
					{
						id: 'analysisStatus',
						header: 'Analysis',
						cell: (item) => <ProcessingStatus status={item.attributes && item.attributes['agie:results:status'] ? item.attributes['agie:results:status'] : undefined}/>,
					},
					{
						id: 'lastAnalysis',
						header: 'Last Analysis',
						cell: (item) =>
							item.attributes && item.attributes['agie:results:updatedAt'] ? (
								<Link
									onFollow={() => {
										const searchParams = new URLSearchParams();
										const bbox = JSON.stringify((item as any).boundingBox);
										searchParams.set('bbox', bbox);
										const farmId = item.id;
										searchParams.set('farmId', farmId);
										const timestamp = new Date(item.attributes!['agie:results:updatedAt']!).toISOString();
										searchParams.set('timestamp', timestamp);
										navigate(`/analysis?${searchParams.toString()}`);
									}}
								>
									{new Date(item.attributes['agie:results:updatedAt']).toLocaleString()}
								</Link>
							) : (
								'-'
							),
					},
				]}
			/>
			{selectedItems[0]?.id && (
				<DeleteFarmModal
					visible={showDeleteModal}
					onCancel={() => setShowDeleteModal(false)}
					onDeleteSuccessful={() => {
						setSelectedItems([]);
						setShowDeleteModal(false);
					}}
					farm={selectedItems[0]}
				/>
			)}
		</>
	);
}

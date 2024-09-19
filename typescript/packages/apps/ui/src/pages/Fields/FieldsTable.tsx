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

import { Polygon } from '@agie/regions';
import { Box, Button, Header, Link, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import { useListPolygonsQuery } from '../../slices/regionsApiSlice';

export default function FieldsTable({ growerId, farmId, variant }: { growerId?: string; farmId?: string; variant: 'container' | 'full-page' }) {
	const navigate = useNavigate();
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { polygons: [] }, isFetching } = useListPolygonsQuery({
		groupId: growerId ?? undefined,
		regionId: farmId ?? undefined,
		count: apiPageSize,
		paginationToken: apiPaginationToken,
		includeLatestState: true,
	});
	const { currentPage, maxKnownPage, handlePageChange, openEnd, items } = usePagination({
		apiPageSize,
		responsePageSize: 10,
		data: data.polygons,
		setApiPaginationToken,
		apiPaginationResponse: data.pagination,
	});
	const [selectedItems, setSelectedItems] = useState<Polygon[]>([]);

	return (
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
							<Button disabled={!selectedItems.length} onClick={() => navigate(`/fields/${selectedItems[0].id}`)}>
								View details
							</Button>
							<Button disabled={!selectedItems.length} onClick={() => navigate(`/fields/${selectedItems[0].id}/edit`)}>
								Edit
							</Button>
							<Button disabled={!selectedItems.length}>Delete</Button>
							{farmId && <Button onClick={() => navigate(`/farms/${farmId}/fields/create`)}>Create Field</Button>}
						</SpaceBetween>
					}
					description="A field is a physical location within a single farm to be analyzed."
				>
					Fields
				</Header>
			}
			empty={
				<Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
					{growerId && farmId ? (
						<SpaceBetween size="m">
							<b>No fields for this farm</b>
							<Button>Create field</Button>
						</SpaceBetween>
					) : (
						<SpaceBetween size="m">
							<b>No fields</b>
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
					cell: (item) => <Link onFollow={() => navigate(`/fields/${item.id}`)}>{item.name}</Link>,
					isRowHeader: true,
				},
				{
					id: 'farm',
					header: 'Farm',
					cell: (item) => <Link onFollow={() => navigate(`/farms/${item.regionId}`)}>{item.regionId}</Link>,
					isRowHeader: true,
				},
				{
					id: 'grower',
					header: 'Grower',
					cell: (item) => <Link onFollow={() => navigate(`/growers/${item.groupId}`)}>{item.groupId}</Link>,
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
					cell: (item) => (item.state?.tags?.plantDate ? new Date(item.state?.tags?.plantDate).toDateString() : '-'),
				},
				{
					id: 'harvestedAt',
					header: 'Harvested At',
					cell: (item) => (item.state?.tags?.harvestDate ? new Date(item.state?.tags?.harvestDate).toDateString() : '-'),
				},
			]}
		/>
	);
}

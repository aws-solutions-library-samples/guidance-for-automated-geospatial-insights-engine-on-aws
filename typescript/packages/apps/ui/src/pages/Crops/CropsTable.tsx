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

import { State } from '@arcade/regions';
import { Box, Button, Header, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import { useListStatesQuery } from '../../slices/regionsApiSlice';

export default function CropsTable({ growerId, fieldId, variant }: { growerId?: string; farmId?: string; fieldId?: string; variant: 'container' | 'full-page' }) {
	const navigate = useNavigate();
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { states: [] }, isFetching, refetch } = useListStatesQuery({ polygonId: fieldId ?? undefined, count: apiPageSize, paginationToken: apiPaginationToken });

	const { currentPage, maxKnownPage, handlePageChange, openEnd, items } = usePagination({
		apiPageSize,
		responsePageSize: 10,
		data: data.states,
		setApiPaginationToken,
		apiPaginationResponse: data.pagination,
	});
	const [selectedItems, setSelectedItems] = useState<State[]>([]);

	return (
		<Table
			variant={variant}
			selectionType="single"
			sortingDisabled
			selectedItems={selectedItems}
			onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
			loading={isFetching}
			loadingText="Loading crops"
			header={
				<Header
					variant={variant === 'full-page' ? 'awsui-h1-sticky' : 'h2'}
					actions={
						<SpaceBetween direction="horizontal" size="xs">
							<Button variant="icon" iconName="refresh" onClick={refetch} />

							<Button disabled={!selectedItems.length} onClick={() => navigate(`/farms/${selectedItems[0].id}`)}>
								View details
							</Button>
							<Button disabled={!selectedItems.length} onClick={() => navigate(`/farms/${selectedItems[0].id}/edit`)}>
								Edit
							</Button>
							<Button disabled={!selectedItems.length}>Delete</Button>
							{growerId && <Button>Create crop</Button>}
						</SpaceBetween>
					}
					description="A Crop Season provides details of the planted crop. Over time there can be multiple Crop Seasons associated with a Field."
				>
					Crops
				</Header>
			}
			empty={
				<Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
					{growerId ? (
						<SpaceBetween size="m">
							<b>No crops for this field</b>
							<Button>Create crop</Button>
						</SpaceBetween>
					) : (
						<SpaceBetween size="m">
							<b>No crops</b>
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
					id: 'plantedAt',
					header: 'Planted At',
					cell: (item) => (item.tags?.plantedAt ? new Date(item.tags?.plantedAt).toDateString() : '-'),
				},
				{
					id: 'harvestedAt',
					header: 'Harvested At',
					cell: (item) => (item.tags?.harvestedAt ? new Date(item.tags?.harvestedAt).toDateString() : '-'),
				},
				{
					id: 'crop',
					header: 'Crop',
					cell: (item) => item.tags?.crop ?? '-',
				},
				{
					id: 'estimatedYield',
					header: 'Estimated Yield',
					cell: (item) => item.attributes?.estimatedYield ?? '-',
				},
			]}
		/>
	);
}

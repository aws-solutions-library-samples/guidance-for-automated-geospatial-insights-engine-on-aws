import { Region } from '@arcade/regions';
import { Box, Button, Header, Link, Pagination, PropertyFilter, PropertyFilterProps, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useListGroupsQuery, useListRegionsQuery } from '../../slices/regionsApiSlice';
import ProcessingStatus from './ProcessingStatus';

export default function ListFarms() {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const {
		data = { regions: [] },
		isFetching,
		refetch,
	} = useListRegionsQuery({
		groupId: searchParams.get('growerId') ?? undefined,
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
	const { data: groupsData = { groups: [] } } = useListGroupsQuery({});
	const searchParamsToQuery = (searchParams: URLSearchParams): PropertyFilterProps.Query => {
		const tokens = [];
		if (searchParams.get('growerId')) {
			tokens.push({ propertyKey: 'growerId', operator: '=', value: searchParams.get('growerId')! });
		}
		return {
			tokens,
			operation: 'and',
		};
	};
	const queryToSearchParams = (prevSearchParams: URLSearchParams, query: PropertyFilterProps.Query): URLSearchParams => {
		const searchParams = new URLSearchParams(prevSearchParams);
		const growerIdFilter = query.tokens.find((item) => item.propertyKey === 'growerId');
		if (growerIdFilter) {
			searchParams.set('growerId', growerIdFilter.value);
		} else {
			searchParams.delete('growerId');
		}
		return searchParams;
	};

	return (
		<Shell
			breadcrumbs={<Breadcrumbs items={[{ text: 'Farms', href: '/farms' }]} />}
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

									<Button disabled={!selectedItems.length} onClick={() => navigate(`/farms/${selectedItems[0].id}`)}>
										View details
									</Button>
									<Button disabled={!selectedItems.length} onClick={() => navigate(`/farms/${selectedItems[0].id}/edit`)}>
										Edit
									</Button>
									<Button disabled={!selectedItems.length}>Delete</Button>
									<Button variant="primary" onClick={() => navigate(`/farms/create`)}>
										Create Farm
									</Button>
								</SpaceBetween>
							}
							description="A farm is comprised of multiple fields and owned by a single grower."
						>
							Farms
						</Header>
					}
					// https://cloudscape.design/components/property-filter?tabId=api
					// https://cloudscape.design/examples/react/server-side-table-property-filter.html
					filter={
						<PropertyFilter
							onChange={({ detail }) => setSearchParams((prev) => queryToSearchParams(prev, detail))}
							query={searchParamsToQuery(searchParams)}
							expandToViewport
							filteringAriaLabel="Find farms"
							filteringPlaceholder="Find farms"
							asyncProperties
							disableFreeTextFiltering
							filteringOptions={[
								...groupsData.groups.map((group) => ({
									propertyKey: 'growerId',
									value: group.id,
									label: group.name,
								})),
							]}
							filteringProperties={[
								{
									key: 'growerId',
									operators: ['='],
									propertyLabel: 'Grower',
									groupValuesLabel: 'Grower values',
								},
							]}
						/>
					}
					empty={
						<Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
							<SpaceBetween size="m">
								<b>No farms</b>
								<Button>Create farm</Button>
							</SpaceBetween>
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
							cell: (item) => <ProcessingStatus status={item.tags && item.tags['arcade:results:status'] ? item.tags['arcade:results:status'] : undefined} />,
						},
						{
							id: 'lastAnalysis',
							header: 'Last Analysis',
							cell: (item) =>
								item.tags && item.tags['arcade:results:updatedAt'] ? (
									<Link
										onFollow={() => {
											const searchParams = new URLSearchParams();
											const bbox = JSON.stringify((item as any).boundingBox);
											searchParams.set('bbox', bbox);
											const farmId = item.id;
											searchParams.set('farmId', farmId);
											const timestamp = new Date(item.tags!['arcade:results:updatedAt']!).toISOString();
											searchParams.set('timestamp', timestamp);
											navigate(`/analysis?${searchParams.toString()}`);
										}}
									>
										{new Date(item.tags['arcade:results:updatedAt']).toLocaleString()}
									</Link>
								) : (
									'-'
								),
						},
					]}
				></Table>
			}
		/>
	);
}

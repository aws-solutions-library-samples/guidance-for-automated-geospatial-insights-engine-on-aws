import { Polygon } from '@arcade/regions';
import { Box, Button, Header, Link, Pagination, PropertyFilter, PropertyFilterProps, SpaceBetween, Table } from '@cloudscape-design/components';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import usePagination from '../../hooks/usePagination';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useListGroupsQuery, useListPolygonsQuery, useListRegionsQuery } from '../../slices/regionsApiSlice';

export default function ListFields() {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const apiPageSize = 20;
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { polygons: [] }, isFetching } = useListPolygonsQuery({
		groupId: searchParams.get('growerId') ?? undefined,
		regionId: searchParams.get('farmId') ?? undefined,
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
	const { data: groupsData = { groups: [] } } = useListGroupsQuery({});
	const { data: regionsData = { regions: [] } } = useListRegionsQuery({});

	const searchParamsToQuery = (searchParams: URLSearchParams): PropertyFilterProps.Query => {
		const tokens = [];
		if (searchParams.get('growerId')) {
			tokens.push({ propertyKey: 'growerId', operator: '=', value: searchParams.get('growerId')! });
		}
		if (searchParams.get('farmId')) {
			tokens.push({ propertyKey: 'farmId', operator: '=', value: searchParams.get('farmId')! });
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
		const farmIdFilter = query.tokens.find((item) => item.propertyKey === 'farmId');
		if (farmIdFilter) {
			searchParams.set('farmId', farmIdFilter.value);
		} else {
			searchParams.delete('farmId');
		}
		return searchParams;
	};

	return (
		<Shell
			breadcrumbs={<Breadcrumbs items={[{ text: 'Fields', href: '/fields' }]} />}
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
									<Button disabled={!selectedItems.length} onClick={() => navigate(`/fields/${selectedItems[0].id}`)}>
										View details
									</Button>
									<Button disabled={!selectedItems.length} onClick={() => navigate(`/fields/${selectedItems[0].id}/edit`)}>
										Edit
									</Button>
									<Button disabled={!selectedItems.length}>Delete</Button>
									<Button variant="primary">Create Field</Button>
								</SpaceBetween>
							}
							description="A field is a physical location within a single farm to be analyzed."
						>
							Fields
						</Header>
					}
					// https://cloudscape.design/components/property-filter?tabId=api
					// https://cloudscape.design/examples/react/server-side-table-property-filter.html
					filter={
						<PropertyFilter
							onChange={({ detail }) => setSearchParams((prev) => queryToSearchParams(prev, detail))}
							query={searchParamsToQuery(searchParams)}
							expandToViewport
							filteringAriaLabel="Find fields"
							filteringPlaceholder="Find fields"
							asyncProperties
							disableFreeTextFiltering
							filteringOptions={[
								...groupsData.groups.map((group) => ({
									propertyKey: 'growerId',
									value: group.id,
									label: group.name,
								})),
								...regionsData.regions.map((region) => ({
									propertyKey: 'farmId',
									value: region.id,
									label: region.name,
								})),
							]}
							filteringProperties={[
								{
									key: 'growerId',
									operators: ['='],
									propertyLabel: 'Grower',
									groupValuesLabel: 'Grower values',
								},
								{
									key: 'farmId',
									operators: ['='],
									propertyLabel: 'Farm',
									groupValuesLabel: 'Farm values',
								},
							]}
						/>
					}
					empty={
						<Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
							<SpaceBetween size="m">
								<b>No fields</b>
								<Button>Create field</Button>
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
							cell: (item) => (item.state?.tags?.plantedAt ? new Date(item.state?.tags?.plantedAt).toDateString() : '-'),
						},
						{
							id: 'harvestedAt',
							header: 'Harvested At',
							cell: (item) => (item.state?.tags?.harvestedAt ? new Date(item.state?.tags?.harvestedAt).toDateString() : '-'),
						},
					]}
				></Table>
			}
		/>
	);
}

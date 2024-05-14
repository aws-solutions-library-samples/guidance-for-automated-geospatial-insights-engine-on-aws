import { Group } from '@arcade/regions';
import { Button, Header, Pagination, SpaceBetween, Table } from '@cloudscape-design/components';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useListGroupsQuery } from '../../slices/regionsApiSlice';

export default function ListGrowers() {
	const apiPageSize = 15;
	const [paginationTokenMap, setPaginationTokenMap] = useState<Map<number, string>>(new Map());
	const [maxKnownPage, setMaxKnownPage] = useState<number>(1);
	const [apiPaginationToken, setApiPaginationToken] = useState<string>();
	const { data = { groups: [] }, isFetching } = useListGroupsQuery({ count: apiPageSize, paginationToken: apiPaginationToken });
	const [selectedItems, setSelectedItems] = useState<Group[]>([]);
	const navigate = useNavigate();
	const [currentPage, setCurrentPage] = useState<number>(1);
	const tablePageSize = 5; // This should evenly divide apiPageSize
	const pageRatio = apiPageSize / tablePageSize;
	const dataLen = data.groups.length;
	const apiPage = Math.ceil(currentPage / pageRatio);
	const maxPageWithLoadedData = Math.ceil(dataLen / tablePageSize) + (apiPage - 1) * pageRatio;
	const dataStart = ((currentPage - 1) % pageRatio) * tablePageSize;
	const dataEnd = Math.min(dataLen, dataStart + tablePageSize);
	const items = useMemo(() => data.groups.slice(dataStart, dataEnd), [data, dataStart, dataEnd]);
	useEffect(() => {
		setMaxKnownPage((prev) => Math.max(prev, maxPageWithLoadedData));
	}, [data]);

	const handlePageChange = (requestedPage: number) => {
		const requestedApiPage = Math.ceil(requestedPage / pageRatio);
		if (requestedApiPage === apiPage) {
			// No need to make a new api call
			setCurrentPage(requestedPage);
		} else {
			if (apiPaginationToken) {
				// Store current pagination token
				setPaginationTokenMap((prevMap) => {
					const newMap = new Map(prevMap);
					newMap.set(apiPage, apiPaginationToken);
					return newMap;
				});
			}
			if (requestedApiPage === 1) {
				setApiPaginationToken(undefined);
				setCurrentPage(requestedPage);
			} else if (requestedApiPage === apiPage + 1) {
				setApiPaginationToken(data!.pagination!.token);
				setCurrentPage(requestedPage);
			} else if (paginationTokenMap.has(requestedApiPage)) {
				// Go to another page
				setApiPaginationToken(paginationTokenMap.get(requestedApiPage));
				setCurrentPage(requestedPage);
			} else {
				console.warn('Requested page not available');
			}
		}
	};
	return (
		<Shell
			breadcrumbs={<Breadcrumbs items={[{ text: 'Growers', href: '/growers' }]} />}
			contentType="table"
			content={
				<Table
					variant="full-page"
					selectionType="single"
					selectedItems={selectedItems}
					onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
					loading={isFetching}
					header={
						<Header
							variant="awsui-h1-sticky"
							actions={
								<SpaceBetween direction="horizontal" size="xs">
									<Button disabled={!selectedItems.length} onClick={() => navigate(`/growers/${selectedItems[0].id}`)}>
										View details
									</Button>
									<Button variant="primary">Create Grower</Button>
								</SpaceBetween>
							}
						>
							Growers
						</Header>
					}
					pagination={
						<Pagination
							currentPageIndex={currentPage}
							pagesCount={maxKnownPage}
							openEnd={data.pagination?.token ? true : false}
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
							cell: (item) => item.name,
							sortingField: 'name',
							isRowHeader: true,
						},
						{
							id: 'acres',
							header: 'Acres',
							cell: (item) => item.attributes?.acres,
						},
						{
							id: 'noFarms',
							header: '# of Farms',
							cell: (item) => item.attributes?.noFarms,
						},
					]}
				></Table>
			}
		/>
	);
}

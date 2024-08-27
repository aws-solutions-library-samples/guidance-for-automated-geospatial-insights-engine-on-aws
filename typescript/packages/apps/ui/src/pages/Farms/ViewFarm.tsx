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

import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, Link, SpaceBetween, Spinner } from '@cloudscape-design/components';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetRegionQuery, useUpdateRegionMutation } from '../../slices/regionsApiSlice';
import FieldsTable from '../Fields/FieldsTable';

export default function ViewFarm() {
	const navigate = useNavigate();
	const { id } = useParams();
	const { data: farm } = useGetRegionQuery(id!);

	const [updateRegion, result] = useUpdateRegionMutation();

	const analyzeRegion = async () => {
		await updateRegion({
			id: id!,
			body: {
				processingConfig: {
					scheduleExpression: `at(${dayjs(new Date()).format('YYYY-MM-DDThh:mm:ss')})`,
					mode: 'scheduled',
				},
			},
		});
	};

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
										{result.isLoading ? <Spinner /> : <Button onClick={async () => await analyzeRegion()}>Analyze</Button>}
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

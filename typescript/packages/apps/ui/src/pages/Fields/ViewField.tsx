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

import { Box, Button, ColumnLayout, Container, ContentLayout, CopyToClipboard, Header, SpaceBetween, Table } from '@cloudscape-design/components';
import { useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import { useGetPolygonQuery } from '../../slices/regionsApiSlice';
import CropsTable from '../Crops/CropsTable';
import { useEffect, useState } from 'react';
import DeleteFieldModal from './DeleteFieldModal';

export default function ViewField() {
	// const navigate = useNavigate();
	const { id } = useParams();
	const { data: field, isLoading: isLoadingPolygon } = useGetPolygonQuery(id!);
	const [coordinates, setCoordinates] = useState<[number, number][]>([]);
	const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
	const navigate = useNavigate();

	useEffect(() => {
		const mergedCoordinates: [number, number][] = [];
		if (field?.boundary) {
			field.boundary.forEach((b1) => {
				b1.forEach((b2) => {
					b2.forEach((coordinate) => {
						mergedCoordinates.push(coordinate);
					});
				});
			});
			setCoordinates(mergedCoordinates);
		}
	}, [field]);


	return (
		<>
			<Shell
				breadcrumbs={
					<Breadcrumbs
						items={[
							{ text: 'Fields', href: '/fields' },
							{ text: id!, href: `/fields/${id}` }
						]}
					/>
				}
				contentType='table'
				content={
					<ContentLayout
						header={
							field && (
								<Header
									variant='h1'
									actions={
										<SpaceBetween direction='horizontal' size='xs'>
											<Button>Edit</Button>
											<Button
												onClick={() => {
													setShowDeleteModal(true);
												}}
											>
												Delete
											</Button>
										</SpaceBetween>
									}
								>
									{field.name}
								</Header>
							)
						}
					>
						<SpaceBetween direction='vertical' size='l'>
							<Container header={<Header variant='h2'>Details</Header>}>
								{field && (
									<ColumnLayout columns={2} variant='text-grid'>
										<SpaceBetween direction='vertical' size='l'>
											<div>
												<Box variant='awsui-key-label'>Name</Box>
												<div>{field!.name}</div>
											</div>
										</SpaceBetween>
										<SpaceBetween direction='vertical' size='l'>
											<div>
												<Box variant='awsui-key-label'>ID</Box>
												<CopyToClipboard
													variant='inline'
													textToCopy={field!.id}
													copyButtonAriaLabel='Copy ID'
													copySuccessText='ID copied'
													copyErrorText='ID failed to copy'
												/>
											</div>
										</SpaceBetween>
									</ColumnLayout>
								)}
							</Container>
							<Table
								header={<Header variant='h2'>Coordinates</Header>}
								loading={isLoadingPolygon}
								items={coordinates ?? []}
								empty={
									<Box margin={{ vertical: 'xs' }} textAlign='center' color='inherit'>
										<SpaceBetween size='m'>
											<b>No coordinates</b>
										</SpaceBetween>
									</Box>
								}
								variant='container'
								columnDefinitions={[
									{
										id: 'latitude',
										header: 'Latitude',
										cell: (item) => item[0] ?? '-',
										maxWidth: '25px'
									},
									{
										id: 'longitude',
										header: 'Longitude',
										cell: (item) => item[1] ?? '-',
										maxWidth: '25px'
									}
								]}
							/>
							{field && <CropsTable variant='container' growerId={field.groupId} farmId={field.regionId} fieldId={field.id} />}
						</SpaceBetween>
					</ContentLayout>
				}
			/>
			{field && id && (
				<DeleteFieldModal
					visible={showDeleteModal}
					onCancel={() => setShowDeleteModal(false)}
					onDeleteSuccessful={() => {
						setShowDeleteModal(false);
						navigate(`/farms/${field.regionId}`);
					}}
					field={field!}
				/>
			)}
		</>
	);
}

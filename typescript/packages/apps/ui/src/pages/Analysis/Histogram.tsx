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

import { Button, Header, Modal, TextContent } from '@cloudscape-design/components';
import { interpolateRdYlGn } from 'd3';
import { useState } from 'react';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryTooltip } from 'victory';
export interface HistogramData {
	min: number;
	max: number;
	buckets: number[];
	count: number;
	bucket_count: number[];
}
function dataToHist(data: any) {
	const output = [];
	for (let i = 0; i < data.bucket_count.length; i++) {
		output.push({
			x: (data.buckets[i] + data.buckets[i + 1]) / 2,
			y: data.bucket_count[i],
			label: `Bucket: (${data.buckets[i].toFixed(2)} - ${data.buckets[i + 1].toFixed(2)}]\nCount: ${data.bucket_count[i]}`,
		});
	}
	return output;
}

const Histogram = ({ data }: { data?: HistogramData }) => {
	return (
		data && (
			<VictoryChart domainPadding={10}>
				<VictoryAxis dependentAxis={true} />
				<VictoryAxis dependentAxis={false} />
				<VictoryBar
					barRatio={1}
					cornerRadius={4}
					labelComponent={<VictoryTooltip />}
					style={{
						data: {
							fill: ({ datum }) => {
								return interpolateRdYlGn(datum.x);
							},
						},
					}}
					domain={{ x: [data.min, data.max], y: [0, Math.max(...data.bucket_count)] }}
					data={dataToHist(data)}
				/>
			</VictoryChart>
		)
	);
};

export const HistogramWithFullscreen = ({ data }: { data?: HistogramData }) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const onCloseModal = () => setIsModalOpen(false);
	const onOpenModal = () => setIsModalOpen(true);

	return (
		<>
			<div style={{ display: 'flex', justifyContent: 'right' }}>
				<Button variant="icon" iconName="expand" onClick={onOpenModal} />
			</div>
			<TextContent>
				<h2>NDVI Histogram</h2>
			</TextContent>
			<Histogram data={data} />
			<Modal header={<Header>NDVI Histogram</Header>} size="large" visible={isModalOpen} onDismiss={onCloseModal}>
				<Histogram data={data} />
			</Modal>
		</>
	);
};

export default Histogram;

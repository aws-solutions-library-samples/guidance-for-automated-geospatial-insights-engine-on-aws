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

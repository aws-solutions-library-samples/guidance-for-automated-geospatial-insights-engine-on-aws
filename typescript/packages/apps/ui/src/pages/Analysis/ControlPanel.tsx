import { Checkbox, SegmentedControl, Select, SpaceBetween } from '@cloudscape-design/components';
import Slider from '@cloudscape-design/components/slider';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';

const baseMapName = import.meta.env.VITE_LOCATION_SERVICE_BASE_MAP_NAME;
const satelliteMapName = import.meta.env.VITE_LOCATION_SERVICE_SAT_MAP_NAME;

interface ChangeEventDetail {
	selectedId: string;
}

interface ChangeSelectEventDetail {
	selectedOption: any;
}

interface ChangeCheckedEventDetail {
	checked: boolean;
}

// Gets the base map name for Amazon Location Service
export function getMapName(mapId: string): string {
	switch (mapId) {
		case 'base-map':
			return baseMapName;
		case 'sat-map':
			return satelliteMapName;
		default:
			return baseMapName;
	}
}

const selectedBandsLabel = {
	rgb: 'RGB',
	ndvi: 'NDVI',
	ndvi_raw: 'NDVI Raw',
	ndvi_change: 'NDVI Change',
	scl: 'SCL',
};

export interface ControlPanelProps {
	selectedMapId: string;
	setSelectedMapId: (selectedMapId: string) => void;
	selectedBandsId: string;
	setSelectedBandsId: (selectedBandsId: string) => void;
	showAnalysis: boolean;
	setShowAnalysis: (showAnalysis: boolean) => void;
	timestamp: string | undefined;
	setTimestamp: (timestamp: string) => void;
}
function getDaysAgoDate(daysAgo: number): Dayjs {
	const today = dayjs().endOf('day'); // Get the end of the current day (just before midnight)
	return today.subtract(daysAgo, 'days');
}

function timestampToDaysAgo(timestamp: string | undefined): number {
	const date = dayjs(timestamp);
	const now = dayjs();
	return now.diff(date, 'day');
}

function useDebounce<T extends (...args: any[]) => void>(callback: T, delay: number) {
	const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

	const debouncedCallback = useCallback(
		(...args: Parameters<T>) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			const newTimeoutId = setTimeout(() => {
				callback(...args);
			}, delay);
			setTimeoutId(newTimeoutId);
		},
		[callback, delay, timeoutId]
	);

	useEffect(() => {
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [timeoutId]);

	return debouncedCallback;
}

const ControlPanel = ({ selectedMapId, setSelectedMapId, selectedBandsId, setSelectedBandsId, showAnalysis, setShowAnalysis, timestamp, setTimestamp }: ControlPanelProps) => {
	const maxDaysAgo = 100;
	const [maxMinusDaysAgo, setMaxMinusDaysAgo] = useState(Math.ceil(maxDaysAgo - timestampToDaysAgo(timestamp)));
	const debouncedSetTimestamp = useDebounce(
		(ts: string) => {
			setTimestamp(ts);
		},
		1000 // Delay in milliseconds (1 second)
	);
	return (
		<SpaceBetween direction="vertical" size="m">
			<SpaceBetween direction="horizontal" size="m" alignItems="center">
				<SegmentedControl
					selectedId={selectedMapId}
					onChange={({ detail }: { detail: ChangeEventDetail }) => setSelectedMapId(detail.selectedId)}
					label="Map Type"
					options={[
						{ text: 'Map', id: 'base-map' },
						{ text: 'Satellite', id: 'sat-map' },
					]}
				/>
				<Select
					selectedOption={{ label: (selectedBandsLabel as any)[selectedBandsId]!, value: selectedBandsId }}
					onChange={({ detail }: { detail: ChangeSelectEventDetail }) => setSelectedBandsId(detail.selectedOption.value)}
					options={[
						{ label: 'RGB', value: 'rgb' },
						{ label: 'NDVI', value: 'ndvi' },
						{ label: 'NDVI Raw', value: 'ndvi_raw' },
						{ label: 'NDVI Change', value: 'ndvi_change' },
						{ label: 'SCL', value: 'scl' },
					]}
				/>
				<Checkbox onChange={({ detail }: { detail: ChangeCheckedEventDetail }) => setShowAnalysis(detail.checked)} checked={showAnalysis}>
					Show Analysis
				</Checkbox>
			</SpaceBetween>
			<div className="slider-container">
				<Slider
					hideFillLine
					min={0}
					max={100}
					step={1}
					value={maxMinusDaysAgo}
					referenceValues={[0, 50, 100]}
					valueFormatter={(value) => {
						return `${getDaysAgoDate(maxDaysAgo - value)
							.toDate()
							.toLocaleDateString()}`;
					}}
					onChange={({ detail }) => {
						setMaxMinusDaysAgo(detail.value);
						debouncedSetTimestamp(getDaysAgoDate(maxDaysAgo - detail.value).toISOString());
					}}
				/>
			</div>
		</SpaceBetween>
	);
};

export default ControlPanel;

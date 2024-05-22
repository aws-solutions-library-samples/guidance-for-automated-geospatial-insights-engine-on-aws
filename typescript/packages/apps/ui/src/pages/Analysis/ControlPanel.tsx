import { Checkbox, SegmentedControl, SpaceBetween } from '@cloudscape-design/components';

const baseMapName = import.meta.env.VITE_LOCATION_SERVICE_BASE_MAP_NAME;
const satelliteMapName = import.meta.env.VITE_LOCATION_SERVICE_SAT_MAP_NAME;

interface ChangeEventDetail {
	selectedId: string;
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

export interface ControlPanelProps {
	selectedMapId: string;
	setSelectedMapId: (selectedMapId: string) => void;
	selectedBandsId: string;
	setSelectedBandsId: (selectedBandsId: string) => void;
	showBoundaries: boolean;
	setShowBoundaries: (showBoundaries: boolean) => void;
}

const ControlPanel = ({ selectedMapId, setSelectedMapId, selectedBandsId, setSelectedBandsId, showBoundaries, setShowBoundaries }: ControlPanelProps) => {
	return (
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
			<SegmentedControl
				selectedId={selectedBandsId}
				onChange={({ detail }: { detail: ChangeEventDetail }) => setSelectedBandsId(detail.selectedId)}
				label="Band Type"
				options={[
					{ text: 'RGB', id: 'rgb' },
					{ text: 'NDVI', id: 'ndvi' },
				]}
			/>
			<Checkbox onChange={({ detail }: { detail: ChangeCheckedEventDetail }) => setShowBoundaries(detail.checked)} checked={showBoundaries}>
				Show Boundaries
			</Checkbox>
		</SpaceBetween>
	);
};

export default ControlPanel;

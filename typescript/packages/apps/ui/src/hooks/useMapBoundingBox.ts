import { useEffect, useState } from 'react';
import { MapRef } from 'react-map-gl/maplibre';

export const useMapBoundingBox = (mapRef: React.RefObject<MapRef | null>) => {
	const [boundingBox, setBoundingBox] = useState<number[] | undefined>(undefined);

	const updateBoundingBox = () => {
		if (mapRef.current) {
			const bounds = mapRef.current.getBounds();
			const boundingBox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
			setBoundingBox(boundingBox);
		}
	};

	useEffect(() => {
		if (mapRef.current) {
			updateBoundingBox();
		}
	}, [mapRef.current]);

	return { boundingBox, updateBoundingBox };
};

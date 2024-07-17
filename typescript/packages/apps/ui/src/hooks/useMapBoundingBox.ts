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

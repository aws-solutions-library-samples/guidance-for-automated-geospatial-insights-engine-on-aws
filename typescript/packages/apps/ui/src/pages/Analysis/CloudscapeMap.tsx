import { borderRadiusContainer, colorBorderDividerDefault } from '@cloudscape-design/design-tokens';
import { Feature, LngLat, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Fragment, useMemo, useRef, useState } from 'react';
import { GeolocateControl, Layer, Map, MapRef, NavigationControl, ScaleControl, Source } from 'react-map-gl/maplibre';
import { useSearchParams } from 'react-router-dom';
import { useMapAuth } from '../../hooks/useMapAuth';
import { useMapBoundingBox } from '../../hooks/useMapBoundingBox';
import { useGetFeaturesQuery } from '../../slices/tilerApiSlice';
import './Analysis.css';
import ControlPanel, { getMapName } from './ControlPanel';
import FeaturePopup from './FeaturePopup';
import { HistogramData } from './Histogram';

const UI_TILER_API_ENDPOINT = import.meta.env.VITE_UI_REST_API_URL;
const MAP_REGION = import.meta.env.VITE_LOCATION_SERVICE_MAP_REGION;

export interface ArcadeFeature extends Feature {
	collection: string;
	assets: {
		ndvi: {
			['raster:band']: { histogram: HistogramData[] }[];
		};
	};
}

interface TileFilterOptions {
	region_id?: string;
	// polygon_id?: string;
	timestamp?: string;
	image_type?: string;
}

const CloudscapeMap = () => {
	const [selectedMapId, setSelectedMapId] = useState('base-map');
	const [selectedBandsId, setSelectedBandsId] = useState('rgb');
	const [showAnalysis, setShowAnalysis] = useState<boolean>(true);
	const [popupInfo, setPopupInfo] = useState<any>(null);
	const mapRef = useRef<MapRef | null>(null);
	const { boundingBox, updateBoundingBox } = useMapBoundingBox(mapRef);
	const transformRequest = useMapAuth();
	const [searchParams] = useSearchParams();
	const [timestamp, setTimestamp] = useState(searchParams.get('timestamp') ?? undefined);
	const bboxToViewState = (bbox: string) => {
		const [minLng, minLat, maxLng, maxLat] = JSON.parse(bbox);
		const sw = new LngLat(minLng, minLat);
		const ne = new LngLat(maxLng, maxLat);
		const llb = new LngLatBounds(sw, ne);
		const paddingPixels = 100;
		return {
			bounds: llb,
			fitBoundsOptions: {
				padding: {
					left: paddingPixels,
					top: paddingPixels,
					right: paddingPixels,
					bottom: paddingPixels,
				},
			},
		};
	};
	const { data: features = [] } = useGetFeaturesQuery(
		{
			bbox: boundingBox!,
			region_id: searchParams.get('farmId') ?? undefined,
			timestamp: timestamp ?? undefined,
		},
		{ skip: boundingBox === undefined }
	);

	const queryString = useMemo(() => {
		// Create a new object with only the properties that have non-undefined values
		const queryParams: TileFilterOptions = {
			region_id: searchParams.get('farmId') ?? undefined,
			timestamp: timestamp ?? undefined,
			image_type: selectedBandsId,
		};
		const filteredQueryParams = Object.entries(queryParams)
			.filter(([_, value]) => value !== undefined)
			.reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

		if (selectedBandsId) {
			queryParams['image_type'] = selectedBandsId;
		}
		return new URLSearchParams(filteredQueryParams).toString();
	}, [selectedBandsId, searchParams, timestamp]);

	const supplementProperties = (feature: ArcadeFeature): ArcadeFeature => {
		const regionId = (feature.collection as string | undefined)?.startsWith('region_') ? (feature.collection as string | undefined)?.split('_')[1] : undefined;
		const polygonId = (feature.id as string | undefined)?.split('_').length === 2 ? (feature.id as string | undefined)?.split('_')[1] : undefined;
		const newFeature = { ...feature, properties: { ...feature.properties, polygonId, regionId, itemId: feature.id, collectionId: feature.collection } };
		return newFeature;
	};
	return (
		<div style={{ position: 'relative', height: '80vh' }}>
			{transformRequest !== undefined && (
				<Map
					// Update the bounding box whenever viewport changes
					onMoveEnd={updateBoundingBox}
					// Store a ref to the map so we can look up the bounding box later
					ref={(map) => {
						mapRef.current = map;
					}}
					// Near the Denver location
					initialViewState={
						searchParams.has('bbox')
							? bboxToViewState(searchParams.get('bbox')!)
							: {
									longitude: -104.4894065,
									latitude: 39.9193435,
									zoom: 13,
							  }
					}
					style={{ height: '100%', borderRadius: borderRadiusContainer, borderColor: colorBorderDividerDefault, borderWidth: '2px', borderStyle: 'solid' }}
					// Amazon Location Service map
					mapStyle={`https://maps.geo.${MAP_REGION}.amazonaws.com/maps/v0/maps/${getMapName(selectedMapId)}/style-descriptor`}
					// Fill layers need to be interactive so they can trigger a popup when clicked
					interactiveLayerIds={features.map((feature: Feature) => `fill-${feature.id}`)}
					// Add auth headers to requests the map component makes
					transformRequest={transformRequest}
					cursor="auto"
					// Trigger a popup about the feature when a fill layer is clicked
					onClick={(e: any) => {
						const clickedFeatures = e.features;
						if (clickedFeatures && clickedFeatures.length > 0) {
							const feature = clickedFeatures[0];
							setPopupInfo({
								lngLat: e.lngLat,
								...feature,
							});
						} else {
							setPopupInfo(null);
						}
					}}
				>
					<ScaleControl />
					<GeolocateControl />
					<NavigationControl />
					<Layer id={'top-layer'} type="background" layout={{ visibility: 'none' }} paint={{}} />
					<Layer id={'bottom-layer'} type="background" layout={{ visibility: 'none' }} paint={{}} beforeId="top-layer" />
					<Source key={`tiles-mosaic`} type="raster" tiles={[`${UI_TILER_API_ENDPOINT}/tiles/{z}/{x}/{y}?${queryString}`]} minzoom={8} maxzoom={16}>
						<Layer
							key={`tiles-layer-mosaic`}
							id={`tiles-layer-mosaic`}
							type="raster"
							layout={{ visibility: showAnalysis ? 'visible' : 'none' }}
							beforeId="bottom-layer"
						/>
					</Source>
					{features.map((feature: ArcadeFeature) => {
						// Two layers are made here:
						// 1. A fill layer that fills the feature boundaries with clear fill so it can be clicked
						// 2. A line layer that outlines the feature boundaries for visibility
						return (
							<Fragment key={feature.id}>
								<Source key={feature.id} id={`boundary-${feature.id}}`} type="geojson" data={supplementProperties(feature)}>
									<Layer
										id={`fill-${feature.id}`}
										type="fill"
										layout={{ visibility: showAnalysis ? 'visible' : 'none' }}
										paint={{
											'fill-color': 'rgba(0, 0, 0, 0)', // Clear fill color
										}}
										beforeId="top-layer"
									/>
									<Layer
										id={`outline-${feature.id}`}
										type="line"
										layout={{ visibility: showAnalysis ? 'visible' : 'none' }}
										paint={{
											'line-color': 'rgba(255, 0, 0, 1)', // Red line color
											'line-width': 3, // Line weight of 3
										}}
										beforeId="top-layer"
									/>
								</Source>
							</Fragment>
						);
					})}
					{popupInfo && (
						// Popup that displays the feature details when a feature is clicked
						<FeaturePopup popupInfo={popupInfo} onClose={() => setPopupInfo(null)} boundingBox={boundingBox} />
					)}
				</Map>
			)}
			<div className="control-panel-container">
				<ControlPanel
					selectedMapId={selectedMapId}
					setSelectedMapId={setSelectedMapId}
					selectedBandsId={selectedBandsId}
					setSelectedBandsId={setSelectedBandsId}
					showAnalysis={showAnalysis}
					setShowAnalysis={setShowAnalysis}
					timestamp={timestamp}
					setTimestamp={setTimestamp}
				/>
			</div>
		</div>
	);
};

export default CloudscapeMap;

import { MapAuthHelper, withIdentityPoolId } from '@aws/amazon-location-utilities-auth-helper';
import { AppLayout, Button, Checkbox, ColumnLayout, Container, ContentLayout, Link, SegmentedControl, SpaceBetween, TextContent } from '@cloudscape-design/components';
import Header from '@cloudscape-design/components/header';
import { borderRadiusContainer, colorBorderDividerDefault } from '@cloudscape-design/design-tokens';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Feature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Fragment, useEffect, useRef, useState } from 'react';
import { GeolocateControl, Layer, Map, MapRef, NavigationControl, Popup, ScaleControl, Source } from 'react-map-gl/maplibre';
import Breadcrumbs from '../shared/Breadcrumbs';
import SideNavigation from '../shared/SideNavigation';
import TopNavigation from '../shared/TopNavigation';
import './Analysis.css';

const UI_TILER_API_ENDPOINT = import.meta.env.VITE_UI_REST_API_URL;
const STAC_API_ENDPOINT = import.meta.env.VITE_STAC_API_ENDPOINT;
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const COGNITO_USER_POOL_REGION = import.meta.env.VITE_COGNITO_USER_POOL_REGION;
// Function to query the STAC API
async function querySTACAPI(bbox: any, maxItems = 20) {
	const [minX, minY, maxX, maxY] = bbox;
	const queryParams = {
		// collections: [STAC_COLLECTION],
		// datetime: `${startDate}/${endDate}`,
		intersects: {
			type: 'Polygon',
			coordinates: [
				[
					[minX, minY],
					[maxX, minY],
					[maxX, maxY],
					[minX, maxY],
					[minX, minY],
				],
			],
		},
		limit: maxItems,
		fields: {
			include: ['id', 'properties', 'assets.ndvi'],
			exclude: ['links', 'assets.blue', 'assets.green', 'assets.ndvi_change', 'assets.nir08', 'assets.red', 'assets.scl'],
		},
		sortBy: [
			{
				field: 'properties.datetime',
				direction: 'desc',
			},
		],
	};

	const response = await fetch(`${STAC_API_ENDPOINT}search`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			// 'Authorization': token || "" // No need for auth while open endpoint
		},
		body: JSON.stringify(queryParams),
	});

	const data = await response.json();
	const features = data.features;
	features.forEach((feature: any) => {
		feature.properties.sceneId = feature.id;
	});
	console.log(data);
	return { features };
}

const baseMapName = import.meta.env.VITE_LOCATION_SERVICE_BASE_MAP_NAME;
const satelliteMapName = import.meta.env.VITE_LOCATION_SERVICE_SAT_MAP_NAME;
const region = import.meta.env.VITE_LOCATION_SERVICE_MAP_REGION;

export default function Analysis() {
	return (
		<>
			<TopNavigation />
			<AppLayout
				toolsHide={true}
				splitPanelOpen={false}
				breadcrumbs={<Breadcrumbs items={[{ text: 'Analysis', href: '/analysis' }]} />}
				navigation={<SideNavigation />}
				contentType="table"
				content={
					<ContentLayout
						header={
							<Header variant="h1" description={'Explore the map below.'}>
								Analysis
							</Header>
						}
					>
						<CloudscapeMap />
					</ContentLayout>
				}
			></AppLayout>
		</>
	);
}

// Gets the base map name for Amazon Location Service
function getMapName(mapId: string): string {
	switch (mapId) {
		case 'base-map':
			return baseMapName;
		case 'sat-map':
			return satelliteMapName;
		default:
			return baseMapName;
	}
}
function getBands(bandsId: string): string {
	switch (bandsId) {
		case 'ndvi':
			return `&colormap_name=viridis&rescale=-1,1&assets=ndvi`;
		// Below used for sentinel images
		// return `&colormap_name=viridis&rescale=-1,1&expression=${encodeURIComponent('(B08-B04)/(B08+B04)')}&asset_as_band=true`;
		case 'rgb':
		default:
			return '&assets=red&assets=green&assets=blue&color_formula=Gamma+RGB+3.5+Saturation+1.7+Sigmoidal+RGB+15+0.35';
		// Below used for sentinel images
		// return '&assets=B04&assets=B03&assets=B02&color_formula=Gamma+RGB+3.5+Saturation+1.7+Sigmoidal+RGB+15+0.35';
	}
}
interface ChangeEventDetail {
	selectedId: string;
}

interface ChangeCheckedEventDetail {
	checked: boolean;
}

interface ArcadeFeature extends Feature {
	collection: string;
}

function CloudscapeMap() {
	const [selectedMapId, setSelectedMapId] = useState('base-map');
	const [selectedBandsId, setSelectedBandsId] = useState('rgb');
	const [showBoundaries, setShowBoundaries] = useState<boolean>(false);
	const [popupInfo, setPopupInfo] = useState<any>(null);
	const [features, setFeatures] = useState<any>([]);
	const authTokenRef = useRef<string>();
	const mapRef = useRef<MapRef | null>(null);
	const [authHelper, setAuthHelper] = useState<MapAuthHelper>();

	useEffect(() => {
		const fetchData = async () => {
			const idToken = (await fetchAuthSession()).tokens?.idToken;
			const token = idToken?.toString();
			authTokenRef.current = token;
			const authHelper = await withIdentityPoolId(IDENTITY_POOL_ID, {
				logins: {
					[`cognito-idp.${COGNITO_USER_POOL_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`]: token!,
				},
			});
			setAuthHelper(authHelper);
		};
		fetchData();
	}, []);

	// Called when the map viewport changes
	// Reads the current boundaries of the map and queries the STAC API for features within those boundaries
	const updateBoundingBox = () => {
		if (mapRef.current) {
			const bounds = mapRef.current.getBounds();
			const boundingBox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
			querySTACAPI(boundingBox)
				.then(({ features }) => {
					setFeatures(features);
				})
				.catch((error) => {
					console.error('Error querying STAC API:', error);
				});
		}
	};

	// Triggers updating the bounding box and querying the STAC API when "Show Boundaries" is checked
	useEffect(() => {
		if (showBoundaries && mapRef.current) {
			updateBoundingBox();
		}
	}, [showBoundaries, mapRef.current]);

	// Gets an auth token when the page loads
	// TODO: Update when the auth token expires
	useEffect(() => {
		const fetchToken = async () => {
			const token = (await fetchAuthSession()).tokens?.idToken?.toString();
			authTokenRef.current = token;
		};
		fetchToken();
	}, []);

	// Passed to the map component to add auth headers to requests it makes dynamically
	const transformRequest = (url: string, resourceType?: string) => {
		if ((resourceType === 'Source' || resourceType === 'Tile') && url.startsWith(UI_TILER_API_ENDPOINT) && authTokenRef.current) {
			return {
				url: url,
				headers: { Authorization: authTokenRef.current },
			};
		} else if (url.startsWith('https://maps.geo.')) {
			return authHelper!.getMapAuthenticationOptions().transformRequest(url, resourceType);
		}
		return { url };
	};

	return (
		<div style={{ position: 'relative', height: '80vh' }}>
			{authHelper && (
				<Map
					// Update the bounding box whenever viewport changes
					onMoveEnd={updateBoundingBox}
					// Store a ref to the map so we can look up the bounding box later
					ref={(map) => {
						mapRef.current = map;
					}}
					// Near the Denver location
					initialViewState={{
						longitude: -104.4894065,
						latitude: 39.9193435,
						zoom: 13,
					}}
					style={{ height: '100%', borderRadius: borderRadiusContainer, borderColor: colorBorderDividerDefault, borderWidth: '2px', borderStyle: 'solid' }}
					// Amazon Location Service map
					mapStyle={`https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${getMapName(selectedMapId)}/style-descriptor`}
					// Fill layers need to be interactive so they can trigger a popup when clicked
					interactiveLayerIds={features.map((feature: Feature) => `fill-${feature.id}`)}
					// Add auth headers to requests the map component makes
					transformRequest={transformRequest}
					// Trigger a popup about the feature when a fill layer is clicked
					onClick={(e: any) => {
						console.log('Clicked:', e);
						const clickedFeatures = e.features;
						if (clickedFeatures && clickedFeatures.length > 0) {
							const feature = clickedFeatures[0];
							console.log('Clicked Feature:', feature);
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
					{features.map((feature: ArcadeFeature) => {
						// Three layers are made here:
						// 1. A raster layer that displays the tif contents
						// 		a. The URL routes to the Tiler endpoint requesting a TileJSON
						// 		b. The URL within the URL contains the STAC endpoint for the feature we want to display
						// 		c. The URL also contains the bands we want to display along with color maps and transformations
						// 		d. The Map component automatically dynamically calls the tiler endpoints returned in the TileJSON
						// 2. A fill layer that fills the feature boundaries with clear fill so it can be clicked
						// 3. A line layer that outlines the feature boundaries for visibility
						return (
							<Fragment>
								<Source
									key={`tiles-${feature.id}`}
									type="raster"
									url={`${UI_TILER_API_ENDPOINT}stac/WebMercatorQuad/tilejson.json?url=${encodeURIComponent(
										`${STAC_API_ENDPOINT}collections/${feature.collection}/items/${feature.id}`
									)}${getBands(selectedBandsId)}`}
								>
									<Layer
										key={`tiles-layer-${feature.id}`}
										id={`tiles-layer-${feature.id}`}
										// TODO: This triggers errors when the outline has not been drawn yet, need to fix.
										beforeId={`outline-${feature.id}`}
										type="raster"
									/>
								</Source>
								<Source key={feature.id} id={`boundary-${feature.id}}`} type="geojson" data={feature}>
									<Layer
										id={`fill-${feature.id}`}
										type="fill"
										layout={{}}
										paint={{
											'fill-color': 'rgba(0, 0, 0, 0)', // Clear fill color
										}}
										filter={showBoundaries}
									/>
									<Layer
										id={`outline-${feature.id}`}
										type="line"
										layout={{}}
										paint={{
											'line-color': 'rgba(255, 0, 0, 1)', // Red line color
											'line-width': 3, // Line weight of 3
										}}
										filter={showBoundaries}
									/>
								</Source>
							</Fragment>
						);
					})}
					{popupInfo && (
						// Popup that displays the feature details when a feature is clicked
						<Popup
							className="apple-popup"
							closeButton={false}
							longitude={popupInfo.lngLat.lng}
							latitude={popupInfo.lngLat.lat}
							anchor="bottom"
							onClose={() => setPopupInfo(null)}
						>
							<Container
								header={
									<div style={{ paddingRight: '10px' }}>
										<Link variant="primary" fontSize="heading-xl">
											{popupInfo.properties.sceneId}
										</Link>
									</div>
								}
							>
								<div className="close-button-container">
									<Button variant="icon" iconName="close" onClick={() => setPopupInfo(null)} />
								</div>
								<TextContent>
									<h4>Timestamp</h4>
									<p>{new Date(popupInfo.properties.datetime).toLocaleString()}</p>
									{/* <h4>Info</h4> */}
									{/* <p>{JSON.stringify(features.find((feature: Feature) => feature.id === popupInfo.properties.sceneId).assets.ndvi['raster:band'][0].histogram[0])}</p> */}
									<h4>Area</h4>
									<p>
										{Math.round(popupInfo.properties['arcade:area'])} {popupInfo.properties['arcade:area_uom']}
									</p>
									<h4>Crop</h4>
									<p>{popupInfo.properties['arcade_agtech:crop']}</p>
									<ColumnLayout columns={2} minColumnWidth={20}>
										<div>
											<h4>Planted</h4>
											<p>{new Date(popupInfo.properties.datetime).toLocaleDateString()}</p>
										</div>
										<div>
											<h4>Harvested</h4>
											<p>June 2021</p>
										</div>
									</ColumnLayout>
									<h4>Description</h4>
									<p>{popupInfo.properties.description}</p>
								</TextContent>
								{/* <Histogram bucketData={features.find((feature: Feature) => feature.id === popupInfo.properties.sceneId).assets.ndvi['raster:band'][0].histogram[0]}/> */}
								{/* <Histogram /> */}
							</Container>
						</Popup>
					)}
				</Map>
			)}
			<div className="control-panel-container">
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
			</div>
		</div>
	);
}

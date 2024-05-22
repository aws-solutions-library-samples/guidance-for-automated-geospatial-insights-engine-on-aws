import { Button, ColumnLayout, Container, Link, TextContent } from '@cloudscape-design/components';
import { Popup } from 'react-map-gl/maplibre';

interface FeaturePopupProps {
	popupInfo: any;
	onClose: () => void;
}

const FeaturePopup = ({ popupInfo, onClose }: FeaturePopupProps) => {
	return (
		<Popup className="apple-popup" closeButton={false} longitude={popupInfo.lngLat.lng} latitude={popupInfo.lngLat.lat} anchor="bottom" onClose={onClose}>
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
					<Button variant="icon" iconName="close" onClick={onClose} />
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
	);
};

export default FeaturePopup;

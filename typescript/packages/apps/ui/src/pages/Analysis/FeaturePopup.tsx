import { Button, ColumnLayout, Container, Grid, Link, Spinner, TextContent } from '@cloudscape-design/components';
import { LngLat, Popup } from 'react-map-gl/maplibre';
import { useNavigate } from 'react-router-dom';
import { useGetPolygonQuery } from '../../slices/regionsApiSlice';
import { useGetFeatureQuery } from '../../slices/tilerApiSlice';
import { HistogramWithFullscreen } from './Histogram';

interface FeaturePopupProps {
	popupInfo: any;
	onClose: () => void;
	boundingBox: number[] | undefined;
}

function getAnchorPosition(boundingBox: number[] | undefined, lngLat: LngLat) {
	if (boundingBox) {
		const [_minLng, minLat, _maxLng, maxLat] = boundingBox;
		const midLat = (maxLat + minLat) / 2;
		return lngLat.lat > midLat ? 'top' : 'bottom';
	}
	return 'top';
}

const FeaturePopup = ({ popupInfo, onClose, boundingBox }: FeaturePopupProps) => {
	const navigate = useNavigate();
	const polygonId = popupInfo.properties.polygonId;
	const itemId = popupInfo.properties.itemId;
	const collectionId = popupInfo.properties.collectionId;
	const { data: polygon, isLoading } = useGetPolygonQuery(polygonId!, { skip: polygonId === undefined });
	const { data: feature, isLoading: isLoadingFeature } = useGetFeatureQuery(
		{ collection_id: collectionId, item_id: itemId },
		{ skip: itemId === undefined || collectionId === undefined }
	);
	return (
		<Popup
			className="feature-popup"
			closeButton={false}
			longitude={popupInfo.lngLat.lng}
			latitude={popupInfo.lngLat.lat}
			maxWidth="500px"
			anchor={getAnchorPosition(boundingBox, popupInfo.lngLat)}
			onClose={onClose}
		>
			<Container
				header={
					<div style={{ paddingRight: '10px' }}>
						{isLoading ? (
							<Spinner />
						) : (
							<Link variant="primary" fontSize="heading-xl" onFollow={() => navigate(`/fields/${polygon?.id}`)}>
								{polygon?.name}
							</Link>
						)}
					</div>
				}
			>
				<div className="close-button-container">
					<Button variant="icon" iconName="close" onClick={onClose} />
				</div>
				<Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
					<div>
						<TextContent>
							<h3>Grower</h3>
							{isLoading ? (
								<Spinner />
							) : (
								<Link variant="primary" fontSize="body-m" onFollow={() => navigate(`/growers/${polygon?.groupId}`)}>
									{polygon?.groupId}
								</Link>
							)}
							<h3>Farm</h3>
							{isLoading ? (
								<Spinner />
							) : (
								<Link variant="primary" fontSize="body-m" onFollow={() => navigate(`/farms/${polygon?.regionId}`)}>
									{polygon?.regionId}
								</Link>
							)}
							<ColumnLayout columns={2} minColumnWidth={20}>
								<div>
									<h3>Acres</h3>
									<p>{isLoading ? <Spinner /> : polygon?.area ? polygon?.area.toFixed(2) : '-'}</p>
									<h3>Planted At</h3>
									<p>{isLoading ? <Spinner /> : polygon?.state?.tags?.plantedAt ? new Date(polygon?.state?.tags?.plantedAt).toDateString() : '-'}</p>
								</div>
								<div>
									<h3>Crop</h3>
									<p>{isLoading ? <Spinner /> : polygon?.state?.tags?.crop ? polygon?.state?.tags?.crop : '-'}</p>
									<h3>Harvested At</h3>
									<p>{isLoading ? <Spinner /> : polygon?.state?.tags?.harvestedAt ? new Date(polygon?.state?.tags?.harvestedAt).toDateString() : '-'}</p>
								</div>
							</ColumnLayout>
						</TextContent>
					</div>
					<div>{isLoadingFeature ? <Spinner /> : <HistogramWithFullscreen data={feature?.assets?.ndvi['raster:band'][0].histogram[0]} />}</div>
				</Grid>
			</Container>
		</Popup>
	);
};

export default FeaturePopup;

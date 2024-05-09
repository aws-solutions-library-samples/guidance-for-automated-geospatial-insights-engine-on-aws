import os
from dataclasses import dataclass, field
import datetime
from io import BytesIO
from logging import Logger
from typing import List, Optional, Tuple

import boto3
import rasterio
import requests
from dataclasses_json import DataClassJsonMixin, config
from numpy import ndarray
from odc.stac import stac_load
from pystac import Item
from pystac_client import Client
from xarray import Dataset

from logger_utils import get_logger
from pystac.extensions.projection import ProjectionExtension
from pyproj import CRS
import shapely.geometry as geom
import geopandas as gpd

STAC_URL = 'https://earth-search.aws.element84.com/v1'
STAC_COLLECTION = 'sentinel-2-c1-l2a'

logger: Logger = get_logger()


@dataclass
class EngineProcessRequest(DataClassJsonMixin):
	schedule_date_time: str = field(metadata=config(field_name="scheduleDateTime"))
	coordinates: List[tuple[float, float]] = field(metadata=config(field_name="coordinates"), default=None)
	group_id: str = field(metadata=config(field_name="groupId"), default=None)
	region_id: str = field(metadata=config(field_name="regionId"), default=None)
	polygon_id: str = field(metadata=config(field_name="polygonId"), default=None)
	output_prefix: str = field(metadata=config(field_name="outputPrefix"), default=None)
	result_id: str = field(metadata=config(field_name="resultId"), default=None)


class STACCatalogProcessor:

	def __init__(
		self,
		request: EngineProcessRequest,
	):
		self.request: EngineProcessRequest = request
		self.stac_item: Optional[Item] = None
		self.previous_tif_raster: Optional[ndarray] = None
		self.bounding_box: Optional[ndarray] = None

	def _load_stac_item(self):
		five_days_before_schedule = (datetime.datetime.strptime(self.request.schedule_date_time, "%Y-%m-%d") - datetime.timedelta(days=5)).strftime("%Y-%m-%d")
		time_filter = "{}/{}".format(five_days_before_schedule, self.request.schedule_date_time)
		CRS = 'epsg:4326'
		polygon = geom.Polygon(self.request.coordinates)
		max_cloud_cover = 10
		polygon_array = [polygon]
		polygon_series = gpd.GeoSeries(polygon_array, crs=CRS)
		# Store the bounding box
		self.bounding_box = polygon_series.total_bounds
		# Set the previous tif raster if any
		# TODO: comment this out for now until result server PRs are merged
		self.previous_tif_raster = self._get_previous_tif(self.request.region_id, self.bounding_box.tolist())
		stac_catalog = Client.open(STAC_URL)
		stac_query = stac_catalog.search(
			bbox=self.bounding_box,
			datetime=time_filter,
			query=[
				# 'eo:cloud_cover<{}'.format(max_cloud_cover)
			],
			collections=[STAC_COLLECTION],
			sortby='-properties.datetime',
			max_items=10
		)

		stac_items = list(stac_query.items())
		print(f"Found: {len(stac_items):d} items")

		# Get the latest satellite image
		stac_items = sorted(stac_items, key=lambda x: x.properties['datetime'])
		latest_stac_item = stac_items.pop()
		self.stac_item = latest_stac_item
		return latest_stac_item

	@staticmethod
	def _get_previous_tif(region_id: str, bounding_box_list: List[tuple[float, float]]):
		arcade_stac_url = os.getenv("ARCADE_STAC_SERVER_URL")
		# Set the API endpoint URL
		url = arcade_stac_url
		# Set the data to be sent in the request body
		data = {
			"collections": ["region_{}".format(region_id)],
			"bbox": bounding_box_list
		}
		# Set any required headers
		headers = {
			"Content-Type": "application/json",
		}
		# Send a POST request to the API
		stac_api_response = requests.post(url, json=data, headers=headers)

		response_data: Optional[dict] = None

		# Check if the request was successful
		if stac_api_response.status_code == 200:
			# Get the response data
			response_data = stac_api_response.json()
		else:
			print(f"Error: {stac_api_response.status_code} - {stac_api_response.text}")

		if response_data is None or response_data.get('features') is None or len(response_data['features']) == 0:
			return None

		asset = response_data['features'].pop()

		s3 = boto3.client('s3')
		try:
			bucket, key = asset['assets']['ndvi']["href"].replace("s3://", "").split("/", 1)
			s3_get_response = s3.get_object(Bucket=bucket, Key=key)
			# Access the object's contents
			object_content = s3_get_response["Body"].read()
			with rasterio.open(BytesIO(object_content)) as src:
				# Access the image data and metadata
				raster_data = src.read()
				return raster_data
		except s3.exceptions.NoSuchKey as e:
			print(f"Error: {e}")

	def load_stac_datasets(self) -> [Dataset, Dataset]:
		self._load_stac_item()
		# default to CRS and resolution from first Item
		sentinel_epsg = ProjectionExtension.ext(self.stac_item).epsg
		output_crs = CRS.from_epsg(sentinel_epsg)

		stac_assets = stac_load(
			[self.stac_item],
			bands=("red", "green", "blue", "nir08", "scl"),  # <-- filter on just the bands we need
			bbox=self.bounding_box,  # <-- filters based on overall polygon boundaries
			output_crs=output_crs,
			resolution=10,
			groupby="solar_day",  # <-- merge tiles of same day
		)
		stac_assets = stac_assets.compute()

		previous_ndvi_raster = None
		try:
			previous_ndvi_raster = self._get_previous_tif(self.request.region_id, self.bounding_box.tolist())
		except Exception as e:
			print(f"Error: {e}")

		return stac_assets, previous_ndvi_raster

import base64
import json
import os
from dataclasses import dataclass, field
from io import BytesIO
from logging import Logger
from typing import List, Optional, Dict
from datetime import datetime, timedelta
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
class State(DataClassJsonMixin):
	attributes: Dict[str, str] = field(metadata=config(field_name="attributes"), default=None)
	tags: Dict[str, str] = field(metadata=config(field_name="tags"), default=None)
	id: str = field(metadata=config(field_name="id"), default=None)
	polygon_id: str = field(metadata=config(field_name="polygonId"), default=None)
	timestamp: str = field(metadata=config(field_name="timestamp"), default=None)
	created_by: str = field(metadata=config(field_name="createdBy"), default=None)
	created_at: str = field(metadata=config(field_name="createdAt"), default=None)
	updated_by: Optional[str] = field(metadata=config(field_name="updatedBy"), default=None)
	updated_at: Optional[str] = field(metadata=config(field_name="updatedAt"), default=None)


@dataclass
class Result(DataClassJsonMixin):
	id: str = field(metadata=config(field_name="id"), default=None)
	status: str = field(metadata=config(field_name="status"), default=None)
	created_at: str = field(metadata=config(field_name="createdAt"), default=None)
	updated_at: Optional[str] = field(metadata=config(field_name="updatedAt"), default=None)


@dataclass
class EngineRequest(DataClassJsonMixin):
	schedule_date_time: str = field(metadata=config(field_name="scheduleDateTime"))
	coordinates: List[tuple[float, float]] = field(metadata=config(field_name="coordinates"), default=None)
	group_id: str = field(metadata=config(field_name="groupId"), default=None)
	region_id: str = field(metadata=config(field_name="regionId"), default=None)
	polygon_id: str = field(metadata=config(field_name="polygonId"), default=None)
	output_prefix: str = field(metadata=config(field_name="outputPrefix"), default=None)
	result_id: str = field(metadata=config(field_name="resultId"), default=None)
	state: State = field(metadata=config(field_name="state"), default=None)
	latest_successful_result: Optional[Result] = field(metadata=config(field_name="latestSuccessfulResult"), default=None)


class STACCatalogProcessor:

	def __init__(
		self,
		request: EngineRequest,
	):
		self.request: EngineRequest = request
		self.stac_item: Optional[Item] = None
		self.previous_tif_raster: Optional[ndarray] = None
		self.bounding_box: Optional[ndarray] = None

	def _load_stac_item(self):

		# get the last successful run from region resource tags
		if self.request.latest_successful_result is not None and self.request.latest_successful_result.created_at is not None:
			last_successful_run = datetime.fromisoformat(self.request.latest_successful_result.created_at).strftime("%Y-%m-%d")
		else:
			# default to 5 days ago if we don't have a previous successful run
			last_successful_run = (datetime.strptime(self.request.schedule_date_time, "%Y-%m-%d") - timedelta(days=5)).strftime("%Y-%m-%d")

		time_filter = "{}/{}".format(last_successful_run, self.request.schedule_date_time)
		CRS = 'epsg:4326'
		polygon = geom.Polygon(self.request.coordinates)
		max_cloud_cover = 10
		polygon_array = [polygon]
		polygon_series = gpd.GeoSeries(polygon_array, crs=CRS)
		# Store the bounding box
		self.bounding_box = polygon_series.total_bounds
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

		if len(stac_items) == 0:
			raise Exception("No items found")

		# Get the latest satellite image
		stac_items = sorted(stac_items, key=lambda x: x.properties['datetime'])
		latest_stac_item = stac_items.pop()
		self.stac_item = latest_stac_item
		return latest_stac_item

	@staticmethod
	def get_previous_tif(region_id: str, result_id: str, polygon_id: str) -> Optional[Item]:
		arcade_stac_url = os.getenv("STAC_SERVER_URL")

		api_key = STACCatalogProcessor.get_api_key()

		# Retrieve the previous result stac item
		url = "{}/collections/region_{}/items/{}_{}".format(arcade_stac_url, region_id, result_id, polygon_id)

		# Set any required headers
		headers = {
			"Content-Type": "application/json",
			"X-API-KEY": api_key
		}
		stac_api_response = requests.get(url, headers=headers)

		if stac_api_response.status_code != 200:
			return None

		response_data = stac_api_response.json()

		s3 = boto3.client('s3')
		try:
			bucket, key = response_data['assets']['ndvi']["href"].replace("s3://", "").split("/", 1)
			s3_get_response = s3.get_object(Bucket=bucket, Key=key)
			# Access the object's contents
			object_content = s3_get_response["Body"].read()
			with rasterio.open(BytesIO(object_content)) as src:
				# Access the image data and metadata
				raster_data = src.read()
				return raster_data
		except s3.exceptions.NoSuchKey as e:
			print(f"Error: {e}")

	@staticmethod
	def get_api_key():
		arcade_stac_api_secret_name = os.getenv("STAC_API_SECRET_NAME")
		secret_manager = boto3.client('secretsmanager')
		secret_value_response = secret_manager.get_secret_value(SecretId=arcade_stac_api_secret_name)
		secret = json.loads(secret_value_response['SecretString'])
		base64_bytes = base64.b64encode(secret['apiKey'].encode("utf-8"))
		api_key = base64_bytes.decode("utf-8")
		return api_key

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

		if self.request.latest_successful_result is not None and self.request.latest_successful_result.id is not None:
			try:
				previous_ndvi_raster = self.get_previous_tif(self.request.region_id, self.request.latest_successful_result.id, self.request.polygon_id)
			except Exception as e:
				print(f"Error: {e}")

		return stac_assets, previous_ndvi_raster

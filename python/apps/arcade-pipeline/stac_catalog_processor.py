import json
from dataclasses import dataclass, field
import datetime
from logging import Logger
from typing import List
import numpy as np
import pyproj
import xarray as xr
from dataclasses_json import DataClassJsonMixin, config
from odc.stac import stac_load
from pystac_client import Client
from shapely import Polygon
from xarray import Dataset

from logger_utils import get_logger
from pystac.extensions.projection import ProjectionExtension
from pyproj import CRS
import shapely.geometry as geom
import geopandas as gpd
import rioxarray

from utils.ndvi_processor import calculate_ndvi_percentage_difference, get_previous_tif

STAC_URL = 'https://earth-search.aws.element84.com/v1'
STAC_COLLECTION = 'sentinel-2-c1-l2a'

logger: Logger = get_logger()


@dataclass
class EngineProcessRequest(DataClassJsonMixin):
	schedule_date_time: str = field(metadata=config(field_name="scheduleDateTime"))
	coordinates: List[tuple[float, float]] = field(metadata=config(field_name="coordinates"), default=None)
	group_id: str = field(metadata=config(field_name="groupId"), default=None)
	region_id: str = field(metadata=config(field_name="regionId"), default=None)
	zone_id: str = field(metadata=config(field_name="zoneId"), default=None)


class STACCatalogProcessor:

	def __init__(
		self,
		request: EngineProcessRequest,
	):
		self.stac_item = None
		self.previous_tif_raster = None
		self.bounding_box = None
		self.request: EngineProcessRequest = request

	def _load_stac_item(self):
		five_days_before_schedule = (datetime.datetime.strptime(self.request.schedule_date_time, "%Y-%m-%d") - datetime.timedelta(days=5)).strftime("%Y-%m-%d")
		time_filter = "{}/{}".format(five_days_before_schedule, self.request.schedule_date_time)
		CRS = 'epsg:4326'
		zone = geom.Polygon(self.request.coordinates)
		max_cloud_cover = 10
		zone_array = [zone]
		zone_series = gpd.GeoSeries(zone_array, crs=CRS)
		# Store the bounding box
		self.bounding_box = zone_series.total_bounds
		# Set the previous tif raster if any
		# TODO: comment this out for now until result server PRs are merged
		# self.previous_tif_raster = get_previous_tif(self.request.region_id, self.bounding_box.tolist())
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
		return latest_stac_item

	def search_stac_items(self):
		self.stac_item = self._load_stac_item()

	def calculate_bands_from_stac_item(self) -> Dataset:
		# default to CRS and resolution from first Item
		sentinel_epsg = ProjectionExtension.ext(self.stac_item).epsg
		output_crs = CRS.from_epsg(sentinel_epsg)

		stac_assets = stac_load(
			[self.stac_item],
			bands=("red", "green", "blue", "nir08", "scl"),  # <-- filter on just the bands we need
			bbox=self.bounding_box,  # <-- filters based on overall zone boundaries
			output_crs=output_crs,
			resolution=10,
			groupby="solar_day",  # <-- merge tiles of same day
		)
		stac_assets = stac_assets.compute()
		return stac_assets

	def calculate_cloud_removal_band(self, stac_assets: Dataset) -> Dataset:
		scl_asset = stac_assets[['scl']]

		cloud_mask = np.logical_not(scl_asset.isin([0, 1, 2, 3, 7, 8, 9, 10, 11]))
		cloud_removed = xr.where(cloud_mask, scl_asset, 0)

		# Perform cloud removal
		stac_assets = stac_assets.assign(scl_cloud_removed=cloud_removed.to_array()[0])
		return stac_assets

	def calculate_ndvi_raw_band(self, stac_assets: Dataset) -> Dataset:
		stac_assets = stac_assets.assign(ndvi_raw=lambda x: (x.nir08 - x.red) / (x.nir08 + x.red))
		return stac_assets

	def fill_cloud_gap(self, stac_assets: Dataset) -> Dataset:
		scl_cloud_removed_array = stac_assets['scl_cloud_removed'].values.flatten()
		has_cloud_gap = len(scl_cloud_removed_array[~np.isnan(scl_cloud_removed_array) & (scl_cloud_removed_array == 0)]) > 0

		if has_cloud_gap and self.previous_tif_raster is not None:
			print('has cloud gap')
			percentage_diff = calculate_ndvi_percentage_difference(self.previous_tif_raster, stac_assets['ndvi_raw'].values)
			print("Before calculation : {}".format(stac_assets['ndvi_raw'].values.flatten()[0]))
			# If a pixel has been removed by the previous cloud removal step, calculate NDVI by multiplying the current NDVI and
			# average percentage diff between the current and previous TIF
			stac_assets["ndvi"] = xr.where(stac_assets["scl_cloud_removed"] == 0, stac_assets["ndvi_raw"] * percentage_diff, stac_assets["ndvi_raw"])
			print("After calculation: {}".format(stac_assets['ndvi'].values.flatten()[0]))
		else:
			print('no cloud gap')
			stac_assets = stac_assets.assign(ndvi=lambda x: x['ndvi_raw'])

		return stac_assets

	def calculate_ndvi_change(self, stac_assets: Dataset) -> Dataset:
		if self.previous_tif_raster is None:
			return stac_assets

		print("Previous NDVI for first pixel: {}".format(self.previous_tif_raster.flatten()[0]))
		print("Current NDVI for first pixel: {}".format(stac_assets['ndvi'].values.flatten()[0]))
		# Calculate the different between current ndvi and the previous ndvi (stored in variable called raster data)
		stac_assets = stac_assets.assign(ndvi_change=stac_assets["ndvi"] - self.previous_tif_raster)
		print("NDVI change: {}".format(stac_assets['ndvi_change'].values.flatten()[0]))
		return stac_assets

	def calculate_area(self) -> float:
		in_crs = pyproj.CRS('EPSG:4326')  # WGS84 (latitude/longitude)
		out_crs = pyproj.CRS('EPSG:3857')  # Web Mercator (meters)
		polygon = Polygon(self.request.coordinates)
		# Create a transformer object
		transformer = pyproj.Transformer.from_crs(in_crs, out_crs, always_xy=True)
		# Transform the polygon coordinates to a projected CRS
		projected_coords = [transformer.transform(*xy) for xy in list(polygon.exterior.coords)]
		# Create a new Shapely Polygon object with the projected coordinates
		projected_polygon = Polygon(projected_coords)
		# Calculate the area in square meters
		area_sq_meters = projected_polygon.area
		# Convert square meters to acres (1 acre = 4046.856422 square meters)
		area_acres = area_sq_meters / 4046.856422
		return area_acres

	def calculate_nitrogen_recommendation(self, yield_target, area_acres) -> object:
		# Calculate nitrogen recommendation target based on yield target
		calculated_nitrogen_target = yield_target * 0.8 * area_acres
		anhydrous_ammonia = calculated_nitrogen_target / 0.82
		urea = calculated_nitrogen_target / 0.46
		uan28 = calculated_nitrogen_target / 3
		monoammonium_phosphate = calculated_nitrogen_target / 0.11
		diammonium_phosphate = calculated_nitrogen_target / 0.18
		return {
			"anhydrous_ammonia": anhydrous_ammonia,
			"urea": urea,
			"uan28": uan28,
			"monoammonium_phosphate": monoammonium_phosphate,
			"diammonium_phosphate": diammonium_phosphate
		}

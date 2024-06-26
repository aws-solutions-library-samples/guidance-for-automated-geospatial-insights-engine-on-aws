import hashlib
import json
import os
import shutil
from typing import List, Dict, Any, Set, Tuple, Optional
import boto3
import numpy as np
from xarray import DataArray, Dataset

# This import is required to extend DataArray functionality with rioxarray
import rioxarray

from stac_catalog_processor import EngineRequest
import geopandas as gpd
import shapely.geometry as geom


class MetadataUtils:

	@staticmethod
	def generate_tif_files(stac_asset: Dataset, temp_dir: str, band_ids: List[str]):
		clipped_path_parent = os.path.join(temp_dir, 'images')

		if os.path.exists(clipped_path_parent):
			shutil.rmtree(clipped_path_parent)

		os.makedirs(clipped_path_parent)

		for band in band_ids:
			if stac_asset.get(band) is not None:
				tif_file_path = os.path.join(clipped_path_parent, "{}.tif".format(band))
				stac_asset[band].rio.to_raster(tif_file_path)

	@staticmethod
	def calculate_checksum(file_path: str, algorithm='md5') -> int:
		hash_obj = getattr(hashlib, algorithm)()
		with open(file_path, "rb") as f:
			while True:
				data = f.read(4096)  # Read the file in chunks
				if not data:
					break
				hash_obj.update(data)
		return hash_obj.hexdigest()

	@staticmethod
	def generate_metadata(sentinel_links: List[Dict[str, Any]], bounding_box: np.ndarray, stac_assets: Dataset, temp_dir: str, bucket_name: str,
						  request: EngineRequest):

		coordinates = request.coordinates

		area_acres = MetadataUtils.calculate_area(coordinates)
		metadata = {
			"bounding_box": bounding_box.tolist(),
			"geometry": {
				'type': 'MultiPolygon',
				'coordinates': coordinates
			},
			"properties": {
				'area_size': area_acres,
				'area_unit_of_measure': 'acres',
			},
			"links": sentinel_links,
			"assets": {
			}
		}

		if request.state is not None and request.state.tags is not None:
			if request.state.tags.get('crop') is not None:
				metadata['properties']['crop_type'] = request.state.tags['crop']
			if request.state.tags.get('plantedAt') is not None:
				metadata['properties']['planted_at'] = request.state.tags['plantedAt']

		for root, dirs, files in os.walk(temp_dir):
			for file in files:
				file_path = os.path.join(root, file)
				s3_key = "{}/{}".format(request.output_prefix, file_path.replace("{}/".format(temp_dir), ''))
				# generate metadata for all band tif file(s)
				if file.endswith('.tif'):
					band = file.replace('.tif', "")
					metadata["assets"][band] = {
						"href": "s3://{}/{}".format(bucket_name, s3_key),
						"type": "image/tiff; application=geotiff; profile=cloud-optimized",
						"title": band,
						"file:checksum": MetadataUtils.calculate_checksum(file_path),
						"file:size": os.path.getsize(file_path),
						"roles": [
							"data",
							"reflectance"
						]
					}

					# generate the histogram for the NDVI band
					if band == 'ndvi' and stac_assets.get('ndvi') is not None:
						# This is the valid range of NDVI
						bins = [-1, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3,
								0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
						metadata["assets"][band]['raster:band'] = [MetadataUtils.generate_histogram(stac_assets[band], bins, (-1, 1), area_acres)]

				# generate metadata for nitrogen recommendation
				elif file == 'nitrogen.json':
					metadata["assets"]['nitrogen_metadata'] = {
						"href": "s3://{}/{}".format(bucket_name, s3_key),
						"type": "application/json",
						"file:checksum": MetadataUtils.calculate_checksum(file_path),
						"file:size": os.path.getsize(file_path),
						"roles": [
							"metadata"
						]
					}

		with open("{}/metadata.json".format(temp_dir), "w") as file:
			# Write content to the file
			file.write(json.dumps(metadata))

	@staticmethod
	def upload_assets(bucket_name: str, key_prefix: str, temp_dir: str):
		# Create an S3 client
		s3 = boto3.client('s3')
		for root, dirs, files in os.walk(temp_dir):
			for file in files:
				# Construct the full file path
				file_path = os.path.join(root, file)
				# Construct the s3 key
				s3_key = "{}/{}".format(key_prefix, file_path.replace("{}/".format(temp_dir), ''))
				# Construct the key (file path in S3)
				key = os.path.relpath(file_path, temp_dir)
				# Upload the file to S3
				s3.upload_file(file_path, bucket_name, s3_key)
				print(f'Uploaded {file_path} to s3://{bucket_name}/{s3_key}')

	@staticmethod
	def calculate_area(coordinates: List[List[List[Tuple[float, float]]]]) -> float:
		polygon_list = []
		for coord in coordinates:
			for test in coord:
				polygon_list.append(geom.Polygon(test))
		polygon_series = gpd.GeoSeries(polygon_list, crs='epsg:4326').to_crs(3827)
		area_sq_m = polygon_series.area.sum()
		# Convert square meters to acres
		area_acres = area_sq_m * 0.000247105
		return area_acres

	@staticmethod
	def generate_nitrogen_metadata(temp_dir: str, yield_target: Optional[float], coordinates: List[List[List[Tuple[float, float]]]]) -> None:
		# If there is no yield target, we cannot process nitrogen recommendation
		if yield_target is None:
			return

		area_acres = MetadataUtils.calculate_area(coordinates)
		rotation_list = [{"name": "corn_to_bean", "value": 0.8}, {"name": "bean_to_corn", "value": 0.8}, {"name": "corn_to_corn", "value": 1}]
		nitrogen_metadata = {}
		for rotation in rotation_list:
			calculated_nitrogen_target = yield_target * rotation['value'] * area_acres
			anhydrous_ammonia = calculated_nitrogen_target / 0.82
			urea = calculated_nitrogen_target / 0.46
			uan28 = calculated_nitrogen_target / 3
			monoammonium_phosphate = calculated_nitrogen_target / 0.11
			diammonium_phosphate = calculated_nitrogen_target / 0.18
			nitrogen_metadata[rotation['name']] = {
				"anhydrous_ammonia": anhydrous_ammonia,
				"urea": urea,
				"uan28": uan28,
				"monoammonium_phosphate": monoammonium_phosphate,
				"diammonium_phosphate": diammonium_phosphate
			}

		nitrogen_file_path = "{}/nitrogen.json".format(temp_dir)
		with open(nitrogen_file_path, "w") as file:
			file.write(json.dumps(nitrogen_metadata))

	@staticmethod
	def generate_histogram(stac_asset_band: DataArray, bins: List[float], range: tuple[float, float], area_acres: float) -> Dict[str, Any]:
		stac_band_array = stac_asset_band.data.flatten()
		filtered_band_array = stac_band_array[~np.isnan(stac_band_array)]
		[band_min, band_max] = range
		counts, _ = np.histogram(filtered_band_array, bins, range)
		statistic = {
			"nodata": 0,
			"data_type": "uint8",
			"histogram": [
				{
					"count": len(filtered_band_array),
					"min": band_min,
					"max": band_max,
					"buckets": bins,
					"bucket_count": [(c / len(filtered_band_array) * area_acres) for c in counts.tolist()],
				}
			],
			"statistics": {
				"minimum": band_min,
				"maximum": band_max,
				"mean": filtered_band_array.mean(),
				"stddev": filtered_band_array.std(),
			}
		}
		return statistic

#   Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
#
#   Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
#   with the License. A copy of the License is located at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#   or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
#   OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
#   and limitations under the License.

from typing import Optional

import numpy as np
import xarray as xr
from xarray import DataArray, Dataset


class XarrayUtils:
	"""
	Utility class for processing xarray Datasets.
	"""

	@staticmethod
	def calculate_ndvi_change(current_ndvi: DataArray, previous_ndvi: np.ndarray) -> DataArray:
		return current_ndvi - previous_ndvi

	@staticmethod
	def calculate_ndvi(stac_asset: Dataset) -> DataArray:
		red = stac_asset["red"].astype("float")
		nir = stac_asset["nir08"].astype("float")
		return (nir - red) / (nir + red)

	@staticmethod
	def remove_cloud(scl_asset: Dataset) -> DataArray:
		# https://custom-scripts.sentinel-hub.com/custom-scripts/sentinel-2/scene-classification/
		# For any pixel that is not vegetation(4), not-vegetated(5) or water(6), we will set this to no data(0)
		cloud_mask = np.logical_not(scl_asset.isin([0, 1, 2, 3, 7, 8, 9, 10, 11]))
		cloud_removed = xr.where(cloud_mask, scl_asset, 0)
		# Perform cloud removal
		return cloud_removed.to_array()[0]

	@staticmethod
	def calculate_ndvi_percentage_difference(previous_ndvi_values: np.ndarray, current_ndvi_values: DataArray) -> float:
		# convert both to one dimensional array
		current_tif_array = current_ndvi_values.ravel()
		previous_tif_array = previous_ndvi_values.ravel()
		# Calculate the percentage difference between current and previous TOI and ignore NDVI that is either 0 or has no value
		prev_aoi_average = np.mean(previous_tif_array[(previous_tif_array != 0) & ~np.isnan(previous_tif_array)])
		curr_aoi_average = np.mean(current_tif_array[(current_tif_array != 0) & ~np.isnan(current_tif_array)])
		percentage_diff = (prev_aoi_average - curr_aoi_average) / prev_aoi_average * 100
		return percentage_diff

	@staticmethod
	def fill_cloud_gap(scl_surface: DataArray, current_ndvi: DataArray, previous_ndvi: Optional[np.ndarray]) -> DataArray:
		scl_surface_array = scl_surface.values.flatten()
		has_cloud_gap = len(scl_surface_array[~np.isnan(scl_surface_array) & (scl_surface_array == 0)]) > 0

		cloud_gap_filled_ndvi: DataArray = current_ndvi.copy()

		if has_cloud_gap and previous_ndvi is not None:
			percentage_diff = XarrayUtils.calculate_ndvi_percentage_difference(previous_ndvi, current_ndvi)
			cloud_gap_filled_ndvi = xr.where(scl_surface == 0, current_ndvi * percentage_diff, current_ndvi)

		return cloud_gap_filled_ndvi

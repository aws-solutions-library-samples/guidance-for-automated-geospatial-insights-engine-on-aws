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

from processors.base_processors import AbstractProcessor
from processors.xarray_utils import XarrayUtils
from xarray import Dataset


class CloudGapFillProcessor(AbstractProcessor):

	def process(self, stac_assets: Dataset) -> Dataset:
		if stac_assets.get('ndvi_raw') is None or stac_assets.get('scl_surface') is None:
			raise ValueError('ndvi_raw or scl_removed values is missing from Dataset')

		stac_assets["ndvi"] = XarrayUtils.fill_cloud_gap(stac_assets["scl_surface"], stac_assets['ndvi_raw'], self.previous_tif_raster)
		return super().process(stac_assets)

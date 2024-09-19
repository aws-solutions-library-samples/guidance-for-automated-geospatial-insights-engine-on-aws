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

from xarray import Dataset

from processors.base_processors import AbstractProcessor
from processors.xarray_utils import XarrayUtils


class NdviChangeProcessor(AbstractProcessor):

	def process(self, stac_assets: Dataset) -> Dataset:
		if stac_assets.get('ndvi') is None:
			raise ValueError('Dataset must have ndvi attribute')

		print(self.previous_tif_raster)

		if self.previous_tif_raster is not None:
			stac_assets['ndvi_change'] = XarrayUtils.calculate_ndvi_change(stac_assets['ndvi'], self.previous_tif_raster)

		return super().process(stac_assets)

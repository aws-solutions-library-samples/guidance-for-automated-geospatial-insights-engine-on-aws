from typing import Dict

from xarray import Dataset

from processors.base_processors import AbstractProcessor
from processors.xarray_utils import XarrayUtils


class NdviRawProcessor(AbstractProcessor):
	def process(self, stac_assets: Dataset) -> Dataset:
		stac_assets['ndvi_raw'] = XarrayUtils.calculate_ndvi(stac_assets)
		return super().process(stac_assets)

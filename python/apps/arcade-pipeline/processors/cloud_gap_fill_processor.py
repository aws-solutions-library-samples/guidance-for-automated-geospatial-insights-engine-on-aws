from xarray import Dataset

from processors.base_processors import AbstractProcessor
from processors.xarray_utils import XarrayUtils


class CloudGapFillProcessor(AbstractProcessor):

	def process(self, stac_assets: Dataset) -> Dataset:
		if stac_assets.get('ndvi_raw') is None or stac_assets.get('scl_surface') is None:
			raise ValueError('ndvi_raw or scl_removed values is missing from Dataset')

		stac_assets["ndvi"] = XarrayUtils.fill_cloud_gap(stac_assets["scl_surface"], stac_assets['ndvi_raw'], self.previous_tif_raster)
		return super().process(stac_assets)

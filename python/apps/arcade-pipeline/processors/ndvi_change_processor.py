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

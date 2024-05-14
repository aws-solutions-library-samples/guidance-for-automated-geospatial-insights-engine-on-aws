from processors.base_processors import AbstractProcessor
from processors.xarray_utils import XarrayUtils
from xarray import Dataset


class CloudRemovalProcessor(AbstractProcessor):

	def process(self, stac_assets: Dataset) -> Dataset:
		if stac_assets.get('scl') is None:
			raise ValueError('scl value is missing from Dataset')

		stac_assets['scl_surface'] = XarrayUtils.remove_cloud(stac_assets[['scl']])
		return super().process(stac_assets)

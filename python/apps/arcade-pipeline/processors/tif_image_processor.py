import numpy as np
from processors.base_processors import AbstractProcessor
from processors.metadata_utils import MetadataUtils
from xarray import Dataset


class TifImageProcessor(AbstractProcessor):
	def __init__(self, temp_dir: str, previous_tif_raster: np.ndarray):
		self.temp_dir = temp_dir
		super().__init__(previous_tif_raster)

	def process(self, stac_assets: Dataset) -> Dataset:
		MetadataUtils.generate_tif_files(stac_assets, self.temp_dir, ['red', 'green', 'blue', 'scl', 'nir08', 'ndvi', 'ndvi_raw', 'scl_surface', 'ndvi_change'])
		return super().process(stac_assets)

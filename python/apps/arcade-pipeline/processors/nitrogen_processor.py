from typing import Set, List, Tuple

import numpy as np
from xarray import Dataset

from processors.base_processors import AbstractProcessor
from processors.metadata_utils import MetadataUtils


class NitrogenProcessor(AbstractProcessor):
	def __init__(self, temp_dir: str, yield_target: float, coordinates: List[List[List[Tuple[float, float]]]], previous_tif_raster: np.ndarray):
		self.yield_target = yield_target
		self.coordinates = coordinates
		self.temp_dir = temp_dir
		super().__init__(previous_tif_raster)

	def process(self, stac_assets: Dataset) -> Dataset:
		MetadataUtils.generate_nitrogen_metadata(self.temp_dir, self.yield_target, self.coordinates)
		return super().process(stac_assets)

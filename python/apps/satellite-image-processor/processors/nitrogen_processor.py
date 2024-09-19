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

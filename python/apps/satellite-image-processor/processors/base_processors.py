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

import hashlib
from abc import ABC, abstractmethod
from typing import Optional, Any, Dict

import numpy as np
from xarray import Dataset


class Processor(ABC):
	"""
	  The Processor interface declares a method for building the chain of processors.
	  It also declares a method for executing a request.
	  """

	def __init__(self, previous_tif_raster: np.ndarray):
		self.previous_tif_raster = previous_tif_raster
		super().__init__()

	@abstractmethod
	def set_next(self, processor: Any) -> Any:
		pass

	@abstractmethod
	def process(self, request: Dataset) -> Dataset:
		pass


class AbstractProcessor(Processor):
	"""
	The default chaining behavior can be implemented inside a base handler
	class.
	"""

	_next_processor: Processor = None

	_checksum_algorithm = 'md5'

	def set_next(self, processor: Processor) -> Processor:
		self._next_processor = processor
		return processor

	@abstractmethod
	def process(self, request: Dataset) -> Dataset:
		if self._next_processor:
			return self._next_processor.process(request)

		return request

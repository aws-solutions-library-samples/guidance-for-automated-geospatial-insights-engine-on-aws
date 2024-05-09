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

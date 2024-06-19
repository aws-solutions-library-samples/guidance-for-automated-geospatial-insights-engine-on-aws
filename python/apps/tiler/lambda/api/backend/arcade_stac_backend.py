import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Type

import attr
import httpx
import morecantile

from api.backend.arcade_stac_reader import STACReader
from api.routers.models import CommonFilterQueryParams
from cogeo_mosaic.backends.base import BaseBackend
from cogeo_mosaic.backends.stac import default_stac_accessor, query_from_link
from cogeo_mosaic.errors import _HTTP_EXCEPTIONS, MosaicError, NoAssetFoundError
from cogeo_mosaic.logger import logger
from cogeo_mosaic.mosaic import MosaicJSON
from rasterio.crs import CRS
from rio_tiler.constants import WEB_MERCATOR_TMS, WGS84_CRS
from rio_tiler.io import BaseReader
from rio_tiler.models import ImageData
from rio_tiler.mosaic import mosaic_reader
from httpx_auth_awssigv4 import SigV4Auth



@attr.s
class ArcadeSTACBackend(BaseBackend):
	# input should be the STAC-API url
	input: str = attr.ib()
	auth: SigV4Auth = attr.ib(default=None)

	arcade_filters: CommonFilterQueryParams = attr.ib(factory=dict)

	minzoom: int = attr.ib()
	maxzoom: int = attr.ib()

	tms: morecantile.TileMatrixSet = attr.ib(default=WEB_MERCATOR_TMS)

	reader: Type[BaseReader] = attr.ib(default=STACReader)
	reader_options: Dict = attr.ib(factory=dict)

	bounds: Tuple[float, float, float, float] = attr.ib(default=(-180, -90, 180, 90))
	crs: CRS = attr.ib(default=WGS84_CRS)
	geographic_crs: CRS = attr.ib(default=WGS84_CRS)

	# STAC API related options
	# max_items |  next_link_key | limit
	stac_api_options: Dict = attr.ib(factory=dict)

	# The reader is read-only, we can't pass mosaic_def to the init method
	mosaic_def: MosaicJSON = attr.ib(init=False)

	_backend_name = "Arcade"

	@minzoom.default
	def _minzoom(self):
		return self.tms.minzoom

	@maxzoom.default
	def _maxzoom(self):
		return self.tms.maxzoom

	def __attrs_post_init__(self):
		"""Post Init."""
		# Construct a FAKE/Empty mosaicJSON
		# mosaic_def has to be defined. As we do for the DynamoDB and SQLite backend
		self.mosaic_def = MosaicJSON(
			mosaicjson="0.0.3",
			name="it's fake but it's ok",
			bounds=self.bounds,
			minzoom=self.minzoom,
			maxzoom=self.maxzoom,
			tiles={},  # we set `tiles` to an empty list.
		)
		self.query = get_query()

	def write(self, overwrite: bool = True):
		"""This method is not used but is required by the abstract class."""
		raise NotImplementedError

	def update(self):
		"""We overwrite the default method."""
		raise NotImplementedError

	def _read(self) -> MosaicJSON:
		"""This method is not used but is required by the abstract class."""
		pass

	def assets_for_tile(self, x: int, y: int, z: int) -> List[str]:
		"""Retrieve assets for tile."""
		bounds = self.tms.bounds(x, y, z)
		geom = {
			"type": "Polygon",
			"coordinates": [
				[
					[bounds[0], bounds[3]],
					[bounds[0], bounds[1]],
					[bounds[2], bounds[1]],
					[bounds[2], bounds[3]],
					[bounds[0], bounds[3]],
				]
			],
		}
		assets = self.get_assets(geom)

		return assets

	def features_for_bbox(self, bbox: List[float]) -> List[Dict]:
		"""Retrieve assets for bbox."""
		geom = {
			"type": "Polygon",
			"coordinates": [
				[
					[bbox[0], bbox[1]],
					[bbox[2], bbox[1]],
					[bbox[2], bbox[3]],
					[bbox[0], bbox[3]],
					[bbox[0], bbox[1]],
				]
			],
		}
		assets = self.get_features(geom)
		return assets

	def get_features(self, geom) -> List[Dict]:
		"""Send query to the STAC-API and retrieve assets."""
		query = self.query.copy()
		query["intersects"] = geom
		query["fields"] = {
			"exclude": [
				"assets",
				"stac_version",
			],
		}
		query["sortBy"] = [{"field": "properties.datetime", "direction": "desc"}]
		if self.arcade_filters.timestamp is not None:
			query["datetime"] = f"/{self.arcade_filters.timestamp.isoformat()}"
		if self.arcade_filters.region_id is not None:
			query["collections"] = ["arcade-polygon"]
			query["query"] = {
				"arcade:regionId": {
					"eq": self.arcade_filters.region_id
				}
			}

		features = _fetch(
			self.auth,
			self.input,
			query,
			**self.stac_api_options,
		)
		latest_features = {}

		for feature in features:
			id_parts = feature["id"].split("_")
			if len(id_parts) != 2:
				continue
			polygon_id = id_parts[1]
			collection = feature["collection"]
			datetime_obj = datetime.fromisoformat(feature["properties"]["datetime"])
			key = (collection, polygon_id)
			if key in latest_features:
				if datetime_obj > datetime.fromisoformat(
					latest_features[key]["properties"]["datetime"]
				):
					latest_features[key] = feature
			else:
				latest_features[key] = feature

		result = list(latest_features.values())
		return result

	def get_assets(self, geom) -> List[str]:
		"""Send query to the STAC-API and retrieve assets."""
		features = self.get_features(geom)
		return [default_stac_accessor(f) for f in features]

	@property
	def _quadkeys(self) -> List[str]:
		return []

	def tile(  # type: ignore
		self,
		x: int,
		y: int,
		z: int,
		reverse: bool = False,
		**kwargs: Any,
	) -> Tuple[ImageData, List[str]]:
		"""Get Tile from multiple observation."""
		mosaic_assets = self.assets_for_tile(x, y, z)
		if not mosaic_assets:
			raise NoAssetFoundError(f"No assets found for tile {z}-{x}-{y}")

		if reverse:
			mosaic_assets = list(reversed(mosaic_assets))

		def _reader(asset: str, x: int, y: int, z: int, **kwargs: Any) -> ImageData:
			with self.reader(
				asset,
				tms=self.tms,
				fetch_options={
					"headers": {
						"Content-Type": "application/json",
						"Accept-Encoding": "gzip",
						"Accept": "application/geo+json"
					},
					"auth": self.auth
				},
				**self.reader_options,
			) as src_dst:
				return src_dst.tile(x, y, z, **kwargs)

		return mosaic_reader(mosaic_assets, _reader, x, y, z, **kwargs)


# @cached(  # type: ignore
#     TTLCache(maxsize=cache_config.maxsize, ttl=cache_config.ttl),
#     key=lambda url, query, **kwargs: hashkey(url, json.dumps(query), **kwargs),
# )
def _fetch(  # noqa: C901
	auth: SigV4Auth,
	stac_url: str,
	query: Dict,
	max_items: Optional[int] = None,
	next_link_key: Optional[str] = None,
	limit: int = 500,
) -> List[Dict]:
	"""Call STAC API."""
	features: List[Dict] = []
	stac_query = query.copy()

	headers = {
		"Content-Type": "application/json",
		"Accept-Encoding": "gzip",
		"Accept": "application/geo+json"
	}

	if "limit" not in stac_query:
		stac_query.update({"limit": limit})

	def _stac_search(url: str, q: Dict):
		try:
			r = httpx.post(url, headers=headers, json=q, auth=auth)
			r.raise_for_status()
		except httpx.HTTPStatusError as e:
			# post-flight errors
			status_code = e.response.status_code
			exc = _HTTP_EXCEPTIONS.get(status_code, MosaicError)
			raise exc(e.response.content) from e
		except httpx.RequestError as e:
			# pre-flight errors
			raise MosaicError(e.args[0].reason) from e
		return r.json()

	page = 1
	while True:
		logger.debug(f"Fetching page {page}")
		logger.debug("query: " + json.dumps(stac_query))

		results = _stac_search(stac_url, stac_query)
		if not results.get("features"):
			break

		features.extend(results["features"])
		if max_items and len(features) >= max_items:
			features = features[:max_items]
			break

		# new STAC context spec
		# {"page": 1, "limit": 1000, "matched": 5671, "returned": 1000}
		# SAT-API META
		# {"page": 4, "limit": 100, "found": 350, "returned": 50}
		ctx = results.get("context", results.get("meta"))
		matched = ctx.get("matched", ctx.get("found"))
		logger.debug(json.dumps(ctx))
		# Check if there is more data to fetch
		if matched <= ctx["returned"]:
			break

		# We shouldn't fetch more item than matched
		if len(features) == matched:
			break

		if len(features) > matched:
			raise MosaicError(
				"Something weird is going on, please open an issue in https://github.com/developmentseed/cogeo-mosaic"
			)
		page += 1

		# https://github.com/radiantearth/stac-api-spec/blob/master/api-spec.md#paging-extension
		if next_link_key:
			links = list(
				filter(lambda link: link["rel"] == next_link_key, results["links"])
			)
			if not links:
				break
			stac_query = query_from_link(links[0], stac_query)
		else:
			stac_query.update({"page": page})

	return features


def get_query() -> Dict:
	"""Get the query from the user."""
	query = {}
	return query


def fetch_feature(auth: SigV4Auth, stac_url: str, collection_id: str = None, item_id: str = None):
	headers = {
		"Content-Type": "application/json",
		"Accept-Encoding": "gzip",
		"Accept": "application/geo+json"
	}
	url = f"{stac_url}collections/{collection_id}/items/{item_id}"
	if collection_id is None or item_id is None:
		raise ValueError("Both collection_id and item_id must be provided.")
	try:
		r = httpx.get(url, headers=headers, auth=auth)
		r.raise_for_status()
	except httpx.HTTPStatusError as e:
		# post-flight errors
		status_code = e.response.status_code
		exc = _HTTP_EXCEPTIONS.get(status_code, MosaicError)
		raise exc(e.response.content) from e
	except httpx.RequestError as e:
		# pre-flight errors
		raise MosaicError(e.args[0].reason) from e
	return r.json()

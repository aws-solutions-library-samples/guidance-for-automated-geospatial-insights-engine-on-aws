from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class CommonFilterQueryParams(BaseModel):
    group_id: Optional[str] = None
    region_id: Optional[str] = None
    polygon_id: Optional[str] = None
    timestamp: Optional[datetime] = datetime.now(timezone.utc)

    class Config:
        json_schema_extra = {
            "group_id": {
                "description": "Optional Group ID used to filter the features"
            },
            "region_id": {
                "description": "Optional Region ID used to filter the features"
            },
            "polygon_id": {
                "description": "Optional Polygon ID used to filter the features"
            },
            "timestamp": {
                "description": "Optional timestamp used to filter the features"
            },
        }


class ImageType(str, Enum):
    rgb = "rgb"
    ndvi = "ndvi"
    ndvi_raw = "ndvi_raw"
    ndvi_change = "ndvi_change"
    scl = "scl"
    
    # scl_surface = "scl_surface"
    # nitrogen_metadata = "nitrogen_metadata"
    # nir08 = "nir08"

import json
from typing import Dict, List

import numpy as np
from api.backend.arcade_stac_backend import ArcadeSTACBackend, fetch_feature
from api.errors import BadRequestError
from api.settings import ApiSettings
from fastapi import APIRouter, Depends, Query, Request, Response
from rio_tiler.colormap import cmap

from .models import CommonFilterQueryParams, ImageType

api_settings = ApiSettings()

router = APIRouter()
arcade_query: Dict = {}


def get_auth_header(request: Request):
    return request.headers.get("Authorization")


def parse_bounding_box(
    bbox: str = Query(
        ...,
        description="A list of four floats representing the bounding box coordinates in the format [min_lon, min_lat, max_lon, max_lat]",
    )
) -> List[float]:
    try:
        bbox_list = [float(x) for x in bbox.strip("[]").split(",")]
        if len(bbox_list) != 4:
            raise BadRequestError("Bounding box must contain exactly 4 coordinates")
        return bbox_list
    except ValueError as e:
        raise BadRequestError(str(e))


@router.get("/features", response_class=Response)
def get_features(
    bbox: List[float] = Depends(parse_bounding_box),
    filter_params: CommonFilterQueryParams = Depends(),
    auth_header: str = Depends(get_auth_header),
):
    with ArcadeSTACBackend(
        f"{api_settings.stac_url}/search",
        auth_token=auth_header,
        arcade_filters=filter_params,
        stac_api_options={"max_items": 10},
        minzoom=8,
        maxzoom=16,
    ) as mosaic:
        features = mosaic.features_for_bbox(bbox)
    return Response(content=json.dumps(features), media_type="application/json")

@router.get("/feature", response_class=Response)
def get_feature(
    collection_id: str = Query(...),
    item_id: str = Query(...),
    auth_header: str = Depends(get_auth_header),
):
    feature = fetch_feature(stac_url=api_settings.stac_url, collection_id=collection_id, item_id=item_id, auth_token=auth_header)
    return Response(content=json.dumps(feature), media_type="application/json")


@router.get("/tiles/{z}/{x}/{y}", response_class=Response)
def get_tile(
    z: int,
    x: int,
    y: int,
    image_type: ImageType = Query(ImageType.rgb, description="The image type"),
    filter_params: CommonFilterQueryParams = Depends(),
    tilesize: int = Query(512, description="The tile size"),
    auth_header: str = Depends(get_auth_header),
):
    with ArcadeSTACBackend(
        f"{api_settings.stac_url}/search",
        auth_token=auth_header,
        arcade_filters=filter_params,
        stac_api_options={"max_items": 10},
        minzoom=8,
        maxzoom=16,
    ) as mosaic:
        match image_type:
            case ImageType.rgb:
                img, _ = mosaic.tile(
                    x, y, z, assets=["red", "green", "blue"], tilesize=tilesize, threads=0
                )
                img.apply_color_formula(
                    "Gamma RGB 3.5 Saturation 1.7 Sigmoidal RGB 15 0.35"
                )
                content = img.render(img_format="PNG")
            case ImageType.ndvi:
                img, _ = mosaic.tile(x, y, z, assets=ImageType.ndvi, tilesize=tilesize, threads=0)
                img.rescale([(-1, 1)])
                cm = cmap.get("RdYlGn")
                content = img.render(img_format="PNG", colormap=cm)
            case ImageType.ndvi_raw:
                img, _ = mosaic.tile(x, y, z, assets=ImageType.ndvi_raw, tilesize=tilesize, threads=0)
                img.rescale([(-1, 1)])
                cm = cmap.get("RdYlGn")
                content = img.render(img_format="PNG", colormap=cm)
            case ImageType.ndvi_change:
                img, _ = mosaic.tile(x, y, z, assets=ImageType.ndvi_change, tilesize=tilesize, threads=0)
                img.rescale([(-1, 1)])
                cm = cmap.get("RdYlGn")
                content = img.render(img_format="PNG", colormap=cm)
            case ImageType.scl:
                img, _ = mosaic.tile(x, y, z, assets=ImageType.scl, tilesize=tilesize, threads=0)
                cm = {
                    0: (0, 0, 0, 255),  # No Data (Missing data)
                    1: (255, 0, 0, 255),  # Saturated or defective pixel
                    2: (47, 47, 47, 255),  # Topographic casted shadows
                    3: (100, 50, 0, 255),  # Cloud shadows
                    4: (0, 160, 0, 255),  # Vegetation
                    5: (255, 230, 90, 255),  # Not-vegetated
                    6: (0, 0, 255, 255),  # Water
                    7: (128, 128, 128, 255),  # Unclassified
                    8: (192, 192, 192, 255),  # Cloud medium probability
                    9: (255, 255, 255, 255),  # Cloud high probability
                    10: (100, 200, 255, 255),  # Thin cirrus
                    11: (255, 150, 255, 255),  # Snow or ice
                }
                content = img.render(img_format="PNG", colormap=cm)
            case _:
                raise BadRequestError(f"Invalid image type: {image_type}")

    return Response(content, media_type="image/png")

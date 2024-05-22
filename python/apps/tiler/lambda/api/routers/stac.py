import json
from typing import Dict, List

from api.backend.arcade_stac_backend import ArcadeSTACBackend
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
        f"{api_settings.stac_url}",
        auth_token=auth_header,
        arcade_filters=filter_params,
        stac_api_options={"max_items": 10},
        minzoom=8,
        maxzoom=16,
    ) as mosaic:
        features = mosaic.features_for_bbox(bbox)
    return Response(content=json.dumps(features), media_type="application/json")


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
        f"{api_settings.stac_url}",
        auth_token=auth_header,
        arcade_filters=filter_params,
        stac_api_options={"max_items": 10},
        minzoom=8,
        maxzoom=16,
    ) as mosaic:
        if image_type == ImageType.rgb:
            img, _ = mosaic.tile(
                x, y, z, assets=["red", "green", "blue"], tilesize=tilesize, threads=0
            )
            img.apply_color_formula(
                "Gamma RGB 3.5 Saturation 1.7 Sigmoidal RGB 15 0.35"
            )
            content = img.render(img_format="PNG")
        elif image_type == ImageType.ndvi:
            img, _ = mosaic.tile(x, y, z, assets="ndvi", tilesize=tilesize, threads=0)
            img.rescale([(-1, 1)])
            cm = cmap.get("viridis")
            content = img.render(img_format="PNG", colormap=cm)

    return Response(content, media_type="image/png")

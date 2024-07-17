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

# Taken from https://github.com/developmentseed/titiler/blob/main/src/titiler/mosaic/titiler/mosaic/errors.py
# https://github.com/developmentseed/titiler/blob/main/src/titiler/core/titiler/core/errors.py

from typing import Callable, Dict, Type

from fastapi import FastAPI
from rasterio.errors import RasterioError, RasterioIOError
from rio_tiler.errors import (
    InvalidAssetName,
    InvalidBandName,
    InvalidColorFormat,
    MissingAssets,
    MissingBands,
    RioTilerError,
    TileOutsideBounds,
    EmptyMosaicError,
)
from cogeo_mosaic.errors import (
    MosaicAuthError,
    MosaicError,
    MosaicNotFoundError,
    NoAssetFoundError,
)

from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

MOSAIC_STATUS_CODES = {
    MosaicAuthError: status.HTTP_401_UNAUTHORIZED,
    EmptyMosaicError: status.HTTP_204_NO_CONTENT,
    MosaicNotFoundError: status.HTTP_404_NOT_FOUND,
    NoAssetFoundError: status.HTTP_204_NO_CONTENT,
    MosaicError: status.HTTP_424_FAILED_DEPENDENCY,
}


class TilerError(Exception):
    """Base exception class."""


class TileNotFoundError(TilerError):
    """Tile not found error."""


class BadRequestError(TilerError):
    """Bad request error."""


DEFAULT_STATUS_CODES = {
    BadRequestError: status.HTTP_400_BAD_REQUEST,
    TileOutsideBounds: status.HTTP_404_NOT_FOUND,
    TileNotFoundError: status.HTTP_404_NOT_FOUND,
    RasterioIOError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    MissingBands: status.HTTP_400_BAD_REQUEST,
    MissingAssets: status.HTTP_400_BAD_REQUEST,
    InvalidColorFormat: status.HTTP_400_BAD_REQUEST,
    InvalidAssetName: status.HTTP_404_NOT_FOUND,
    InvalidBandName: status.HTTP_404_NOT_FOUND,
    RasterioError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    RioTilerError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    Exception: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


def exception_handler_factory(status_code: int) -> Callable:
    """
    Create a FastAPI exception handler from a status code.
    """

    def handler(request: Request, exc: Exception):
        if status_code == status.HTTP_204_NO_CONTENT:
            return Response(content=None, status_code=204)

        return JSONResponse(content={"detail": str(exc)}, status_code=status_code)

    return handler


def add_exception_handlers(
    app: FastAPI, status_codes: Dict[Type[Exception], int]
) -> None:
    """
    Add exception handlers to the FastAPI app.
    """
    for exc, code in status_codes.items():
        app.add_exception_handler(exc, exception_handler_factory(code))

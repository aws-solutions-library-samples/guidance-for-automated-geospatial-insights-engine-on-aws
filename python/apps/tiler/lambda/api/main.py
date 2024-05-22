import logging
from fastapi import FastAPI
from api.routers import stac
from starlette.middleware.cors import CORSMiddleware
from api.errors import DEFAULT_STATUS_CODES, MOSAIC_STATUS_CODES, add_exception_handlers
from api.settings import ApiSettings

logging.getLogger("botocore.credentials").disabled = True
logging.getLogger("botocore.utils").disabled = True
logging.getLogger("rio-tiler").setLevel(logging.DEBUG)

api_settings = ApiSettings()

app = FastAPI(
    title=api_settings.name,
    openapi_url="/api",
    docs_url="/api.html",
    description="A custom tile server for ARCADE",
    version="1.0.0",
    root_path=api_settings.root_path,
    dependencies=[],
)

# app.include_router(tiles.router)
app.include_router(stac.router)
# Set all CORS enabled origins
if api_settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=api_settings.cors_origins,
        allow_credentials=True,
        allow_methods=api_settings.cors_allow_methods,
        allow_headers=["*"],
    )
add_exception_handlers(app, DEFAULT_STATUS_CODES)
add_exception_handlers(app, MOSAIC_STATUS_CODES)

# Set all CORS enabled origins
if api_settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=api_settings.cors_origins,
        allow_credentials=True,
        allow_methods=api_settings.cors_allow_methods,
        allow_headers=["*"],
    )

"""AWS Lambda handler."""

import logging

from mangum import Mangum
from titiler.application.main import app
from titiler.application.settings import ApiSettings

logging.getLogger("mangum.lifespan").setLevel(logging.DEBUG)
logging.getLogger("mangum.http").setLevel(logging.DEBUG)

api_settings = ApiSettings()

handler = Mangum(app, api_gateway_base_path=api_settings.root_path, lifespan="auto")

"""AWS Lambda handler."""

import logging

from api.main import app
from api.settings import ApiSettings
from mangum import Mangum

logging.getLogger("mangum.lifespan").setLevel(logging.ERROR)
logging.getLogger("mangum.http").setLevel(logging.ERROR)

api_settings = ApiSettings()

handler = Mangum(app, api_gateway_base_path=api_settings.root_path, lifespan="auto")

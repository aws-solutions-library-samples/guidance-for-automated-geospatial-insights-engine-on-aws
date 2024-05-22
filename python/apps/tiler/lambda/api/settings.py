""" API settings."""

from pydantic import field_validator
from pydantic_settings import BaseSettings


class ApiSettings(BaseSettings):
    """FASTAPI application settings."""

    name: str = "ArcadeTiler"
    cors_origins: str = "*"
    cors_allow_methods: str = "GET"
    root_path: str = ""
    debug: bool = False
    stac_url: str = None

    @field_validator("cors_origins")
    def parse_cors_origin(cls, v):
        """Parse CORS origins."""
        return [origin.strip() for origin in v.split(",")]

    @field_validator("cors_allow_methods")
    def parse_cors_allow_methods(cls, v):
        """Parse CORS allowed methods."""
        return [method.strip().upper() for method in v.split(",")]

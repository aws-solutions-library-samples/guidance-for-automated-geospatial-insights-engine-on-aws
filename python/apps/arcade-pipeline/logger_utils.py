import logging
from typing import Optional


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Returns a logger, with a preconfigured log level.
    Use this to get a logger for all log statements in this code
    package.
    """
    logger = logging.getLogger(name)
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s: %(message)s"
    )
    return logger

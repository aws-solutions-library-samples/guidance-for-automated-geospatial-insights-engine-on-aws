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

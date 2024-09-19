#!/bin/bash

#
#  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
#  with the License. A copy of the License is located at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
#  and limitations under the License.
#

# Retrieve the website hosting bucket
AGIE_WEBSITE_BUCKET=$(aws ssm get-parameters --names /agie/${ENVIRONMENT}/ui/websiteBucket --query 'Parameters[0].Value' --output text)

# Upload the bundled artifacts to the bucket
aws s3 sync ./dist s3://"$AGIE_WEBSITE_BUCKET"

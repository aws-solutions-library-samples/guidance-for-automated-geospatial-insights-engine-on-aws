#!/bin/bash

# Retrieve the website hosting bucket
ARCADE_WEBSITE_BUCKET=$(aws ssm get-parameters --names /arcade/${ENVIRONMENT}/ui/websiteBucket --query 'Parameters[0].Value' --output text)

# Upload the bundled artifacts to the bucket
aws s3 sync ./dist s3://"$ARCADE_WEBSITE_BUCKET"

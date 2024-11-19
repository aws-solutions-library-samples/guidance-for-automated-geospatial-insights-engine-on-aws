# Change Log - @agie/executor

This log was last generated on Tue, 19 Nov 2024 00:04:28 GMT and should not be manually modified.

## 0.2.0
Tue, 19 Nov 2024 00:04:28 GMT

### Minor changes

- Removed authz plugin and related files, replacing with @agie/rest-api-authorizer
- Added EnginesClient to JobsService and module.awilix

### Patches

- Updated imports to use @agie/rest-api-authorizer instead of local scopes
- Modified JobsService to use EnginesClient for job definition retrieval

## 0.1.0
Thu, 31 Oct 2024 05:15:58 GMT

### Minor changes

- Added new API endpoints and functionality for managing execution tasks and task items
- Added new schemas and models for execution tasks and task items
- Added new repository and service layers for execution tasks and task items
- Added new dependencies for DynamoDB, SQS, and other AWS services


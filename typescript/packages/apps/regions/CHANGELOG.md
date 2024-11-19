# Change Log - @agie/regions

This log was last generated on Tue, 19 Nov 2024 00:04:28 GMT and should not be manually modified.

## 1.0.0
Tue, 19 Nov 2024 00:04:28 GMT

### Breaking changes

- Removed common/scopes.ts file and replaced its usage with @agie/rest-api-authorizer

### Minor changes

- Added new dependencies: @agie/clients, @agie/lambda-invoker, and @aws-sdk/client-lambda
- Added engineId to processingConfig schema in regions/schemas.ts
- Updated RegionService to include enginesClient in constructor and added validation for engineId
- Updated module.awilix.ts to include new dependencies and services

## 0.0.2
Thu, 31 Oct 2024 05:15:58 GMT

### Patches

- Minor refactoring in TaskService class: Added async/await syntax to the SQS message sending process for better asynchronous handling.


# Executor Module

## Overview

The `Executor` module manages the execution of the engine analysis triggered by schedule or new sentinel images that match created regions in `AGIE`.

## Architecture

![conceptual](docs/images/AGIE%20HLA-executor-conceptual.png)

The `Executor` module subscribes to events from the `Scheduler` module (e.g. recurring schedule or new scene events), creates a task and adds to a processing queue based on the priority configured when a `Region` is created.  The `Executor` module queries the `Regions` API to retrieve all the input required to run the task. The task procesess the satellite images, extracts all the necessary information and images and publish the analysis result to the `Result` module to be stored in AGIE Stac Server.

### AGIE Conceptual Architecture

![logical](docs/images/AGIE%20HLA-executor.png)

The `Executor` module runs the engine analysis task in AWS Batch which will schedule it as a Fargate task. It uses AWS Batch [Job Queues](https://docs.aws.amazon.com/batch/latest/userguide/job_queues.html) features to prioritise job based on configuration. You can customize the provided container image and use your own algorithm in the analysis.

## Application Events

```json
{
  "version": "0",
  "id": "b06dbe5c-19bc-4244-ac3d-84ced74e53e6",
  "detail-type": "com.aws.agie.results>Result>created",
  "source": "com.aws.agie.executor",
  "account": "xxxxxxxxxxxx",
  "time": "2014-04-22T18:43:48Z",
  "detail": {
  "eventType": "created",
  "id": "ab6gtsfabc61",
  "resourceType": "Job",
  "old": {
    // resource attributes before the update
  },
  "new": {
    // resource attributes after the update
  }
}
```

Of interest here:

- `detail-type` is comprised of `com.aws.agie.executor>:resourceType>:eventType`.
- `source` is the identifier of the module -  `com.aws.agie.executor`.
- `eventType` is one of `created`, `updated`, or `deleted`.
- `resourceType` is `Job`.
- `old` is provided when `eventType` is `updated` or `deleted`.
- `new` is provided when `eventType` is `created` or `updated`.

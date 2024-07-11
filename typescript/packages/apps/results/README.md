# Results Module

## Overview

The `Results` module acts as an intermediary between the `Regions` and `Executor` modules, transforming and publishing `Region` data to a STAC server, and mapping execution results to their corresponding Regions. This enables efficient spatial data management, retrieval, and access to execution results for specific Regions.


## Architecture

### ARCADE Conceptual Architecture

![conceptual](docs/images/ARCADE%20HLA-results-conceptual.png)

The `Results` module is intended to be orchestrated by a _UI_, or some other application or system, e.g. a _UI_ could provide the ability for users to view the execution results related to specific `Region`.

The `Results` module subscribes to Create, Read, Update, and Delete (CRUD) events from `Regions` module. Upon receiving these events, it transforms the relevant data to STAC (SpatioTemporal Asset Catalog) [item](https://github.com/radiantearth/stac-spec/blob/master/item-spec/item-spec.md) or [collection](https://github.com/radiantearth/stac-spec/blob/master/collection-spec/collection-spec.md) and publishes them to ARCADE [STAC server](https://github.com/stac-utils/stac-server). This process enables users to query and retrieve `Polygon` and `Region` data within a specified bounding box, allowing for efficient spatial data management and retrieval.

In addition to subscribing to region-related CRUD events, the `Notification` module also subscribes to `Job change` events from the `Executor` module. These events are triggered when there are updates or changes to the processing jobs. By subscribing to these Job change events, the notifications module can capture and store the execution results mapped to their respective `Regions`. This mapping enables users to retrieve and access the execution results specific to a particular `Region`.

### Results Logical Architecture

![logical](docs/images/ARCADE%20HLA-results.png)

The `Results` module provides a REST API (see [swagger](./docs/swagger.json)) to query the execution result of `Engine` module. The REST API is implemented as a fat lambda that is proxied via API Gateway.

API Gateway utilizes Cognito for authentication, and Verified Permissions for authorization. Currently, authorization is performed at the REST API endpoint level (e.g. only `admin`'s allowed to `POST`), but the use of Verified Permissions allows this to be extended to FGAC (fine-grained access control) if needed in the future.

DynamoDB is used as the datastore. A single table design is taken, with composite keys, GSI overloading, and GSI sharding. Refer to [DynamoDB design doc](./docs/DynamoDB%20design.md) for further details.


### STAC API

`Result` module includes the deployment of [Stac-server](https://github.com/stac-utils/stac-server). The infrastructure code had been ported from `Serverless` framework to `AWS CDK` stack to simplify the deployment and integration between `ARCADE` and `Stac-server`.

The `Stac-server` API Gateway had configured with IAM Authentication to support both front-end and back-end clients. In the backend, you can use libraries such as [aws4-axios](https://github.com/jamesmbourne/aws4-axios) for NodeJS or [aws-requests-auth](https://github.com/DavidMuller/aws-requests-auth) for Python to signed the API requests with your temporary IAM credentials when invoking the API. In the front end, you can create Amazon Cognito Identity Pools to generate temporary IAM credentials for your user and uses *aws4-axios* to sign the requests when invoking the `Stac-server` API.

## Application Events

```json
{
  "version": "0",
  "id": "b06dbe5c-19bc-4244-ac3d-84ced74e53e6",
  "detail-type": "com.aws.arcade.results>Result>created",
  "source": "com.aws.arcade.results",
  "account": "xxxxxxxxxxxx",
  "time": "2014-04-22T18:43:48Z",
  "detail": {
  "eventType": "created",
  "id": "ab6gtsfabc61",
  "resourceType": "Result",
  "old": {
    // resource attributes before the update
  },
  "new": {
    // resource attributes after the update
  }
}
```

Of interest here:

- `detail-type` is comprised of `com.aws.arcade.results>:resourceType>:eventType`.
- `source` is the identifier of the module -  `com.aws.arcade.results`.
- `eventType` is one of `created`, `updated`, or `deleted`.
- `resourceType` is `Result`.
- `old` is provided when `eventType` is `updated` or `deleted`.
- `new` is provided when `eventType` is `created` or `updated`.


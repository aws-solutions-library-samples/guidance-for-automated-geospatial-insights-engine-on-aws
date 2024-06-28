# Regions Module

## Overview

The `Regions` module manages the hierarchical structures of groups, regions, polygons, and states. It publishes events when changes occur, allowing other components like the Scheduler to react accordingly.

## Architecture

### ARCADE Conceptual Architecture

![conceptual](docs/images/ARCADE%20HLA-regions-conceptual.png)

The `Regions` module is intended to be orchestrated by a _UI_, or some other application or system, e.g. a _UI_ could provide the ability for users to manage these hierarchies manually, or an _application_ could be written that defines the hierarchies by importing from another system.

When any part of the hierarchy changes, the `Regions` module publishes events. Within ARCADE, the `Scheduler` module subscribes to `Region` change events to process any changes to its job processing schedule.

### Regions Logical Architecture

![logical](docs/images/ARCADE%20HLA-regions.png)

The `Regions` module provides a REST API (see [swagger](./docs/swagger.json)) to enable the management of groups, regions, polygons, and states. The REST API is implemented as a fat lambda that is proxied via API Gateway.

API Gateway utilizes Cognito for authentication, and Verified Permissions for authorization. Currently, authorization is performed at the REST API endpoint level (e.g. only `admin`'s allowed to `POST`), but the use of Verified Permissions allows this to be extended to FGAC (fine-grained access control) if needed in the future.

DynamoDB is used as the datastore. A single table design is taken, with composite keys, GSI overloading, and GSI sharding. Refer to [DynamoDB design doc](./docs/DynamoDB%20design.md) for further details.

## Application Events

Upon any type of change event ('created', 'updated', 'deleted') of any resource ('Group', 'Region', 'Polygon', 'State'), an event is published to EventBridge. An example is as follows:

```json
{
  "version": "0",
  "id": "b06dbe5c-19bc-4244-ac3d-84ced74e53e6",
  "detail-type": "com.aws.arcade.regions>Group>updated",
  "source": "com.aws.arcade.regions",
  "account": "111122223333",
  "time": "2014-04-22T18:43:48Z",
  "detail": {
  "eventType": "updated",
  "id": "ab6gtsfabc61",
  "resourceType": "Group",
  "old": {
    // resource attributes before the update
  },
  "new": {
    // resource attributes after the update
  }
}
```

Of interest here:

- `detail-type` is comprised of `com.aws.arcade.regions>:resourceType>:eventType`.
- `source` is the identifier of the module -  `com.aws.arcade.regions`.
- `eventType` is one of `created`, `updated`, or `deleted`.
- `resourceType` is one of `Group`, `Region`, `Polygon`, or `State`.
- `old` is provided when `eventType` is `updated` or `deleted`.
- `new` is provided when `eventType` is `created` or `updated`.

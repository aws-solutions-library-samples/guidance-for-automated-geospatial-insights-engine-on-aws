# Notifications Module

## Overview

The _notifications_ module manages user's subscription to notifications generate by ARCADE modules. For now, it only supports `sms` subscription using the mobile number entered in Cognito during registration.

## Walkthrough

The following walkthrough describes how to subscribe to notification for a particular `Region`.

A collection of the available REST API endpoints and requests is [provided](./docs/regions.insomnia.json) that can be imported into [Insomnia](https://insomnia.rest/products/insomnia). This collection was automatically created by importing the provided [swagger](./docs/swagger.json) - the same approach can be used with other REST clients, such as [Postman](https://www.postman.com/product/rest-client/), if Insomnia is not used.


### Pre-requisite

Follow the guide [here](../regions/README.md) to create, list and delete `Subscription`. You will use the `id` of the `Region` resource when creating subscription.

### i. Set up Authentication

To use the _regions module_ REST API an authorization token, more specifically the `IdToken` token from Cognito, is required. An example of retrieving one using the AWS CLI is as follows. Ensure the `???` placeholders are replaced with valid configuration:

> TODO: replace this with something more user friendly, e.g. auth via UI

```shell
> aws cognito-idp admin-initiate-auth \
  --user-pool-id ??? \
  --client-id ??? \
  --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=???,PASSWORD=??? \
  | jq -r '.AuthenticationResult.IdToken'
```

In all the sample requests following, replace `<AUTH_TOKEN>` with the `IdToken`.

### i. Create a Subscription for a Region

**Request:**

```http
POST /regions/<REGION_ID>/subscriptions
Content-Type: application/json
Accept-Version: 1.0.0
Accept: application/json
Authorization: Bearer <AUTH_TOKEN>

{

}
```

**Example Response:**

```http
Content-Type: application/json
x-id: 01hwke0d3f03j7rtyjna7npdj8

{
    "id": "01hyyd2dmqyqvrp7xzzkcczz0e",
    "regionId": "01hyw34fnhd6mayn743mv6h1cc",
    "createdAt": "2024-05-28T01:29:38.711Z"
}
```

## ii. Viewing the list of subscriptions

**Request:**

```http
GET /subscriptions
Accept-Version: 1.0.0
Accept: application/json
Authorization: Bearer <AUTH_TOKEN>
```

## iii. Delete a subscription

**Request:**

```http
DELETE /subscriptions/<SUBSCRIPTION_ID>
Accept-Version: 1.0.0
Accept: application/json
Authorization: Bearer <AUTH_TOKEN>
```

## Architecture

### ARCADE Conceptual Architecture

The _notifications module_ is intended to be orchestrated by a _UI_, or some other application or system, e.g. a _UI_ could provide the ability for users to subscribe notifications related to specific `Region`.

When user subscribes to notification for a region, the _notifications module_ publishes events. In the ARCADE system, the _notifications_ module is subscribed to `Job change` events. These events are published by the _executor_ module whenever it processes images for a specific region. By subscribing to these events, the notifications module can receive real-time updates on the status and progress of image processing jobs.

### Notifications Logical Architecture


![logical](docs/images/ARCADE%20HLA-notifications.png)

The _regions module_ provides a REST API (see [swagger](./docs/swagger.json)) to enable the creation and deletion of subscription of `Region` events. The REST API is implemented as a fat lambda that is proxied via API Gateway.

API Gateway utilizes Cognito for authentication, and Verified Permissions for authorization. Currently, authorization is performed at the REST API endpoint level (e.g. only `admin`'s allowed to `POST`), but the use of Verified Permissions allows this to be extended to FGAC (fine-grained access control) if needed in the future.

DynamoDB is used as the datastore. A single table design is taken, with composite keys, GSI overloading, and GSI sharding. Refer to [DynamoDB design doc](./docs/DynamoDB%20design.md) for further details.

SNS is the messaging service used to broadcast notifications. A dedicated SNS topic is created for each region within the ARCADE platform. Whenever a notification needs to be sent, a message is published to the topic. This message is then automatically forwarded to all users who have subscribed to that particular topic.


## Applications Events

```json
{
  "version": "0",
  "id": "b06dbe5c-19bc-4244-ac3d-84ced74e53e6",
  "detail-type": "com.aws.arcade.notifications>Subscription>created",
  "source": "com.aws.arcade.notifications",
  "account": "111122223333",
  "time": "2014-04-22T18:43:48Z",
  "detail": {
  "eventType": "created",
  "id": "ab6gtsfabc61",
  "resourceType": "Subscription",
  "old": {
    // resource attributes before the update
  },
  "new": {
    // resource attributes after the update
  }
}
```

Of interest here:

- `detail-type` is comprised of `com.aws.arcade.notifications>:resourceType>:eventType`.
- `source` is the identifier of the module -  `com.aws.arcade.notifications`.
- `eventType` is one of `created`, `updated`, or `deleted`.
- `resourceType` is `Subscription`.
- `old` is provided when `eventType` is `updated` or `deleted`.
- `new` is provided when `eventType` is `created` or `updated`.


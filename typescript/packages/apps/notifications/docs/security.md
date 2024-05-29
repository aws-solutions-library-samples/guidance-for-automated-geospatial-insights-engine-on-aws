# Notifications Module Authentication & Authorization

Authentication of users is carried out using Amazon Cognito, and authorization of users using [Amazon Verified Permissions](https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/what-is-avp.html).

Users within Cognito are assigned a role of `admin`, `contributor`, or `reader`.

## REST API Authorization

The following actions and permissions are configured:

| Action             | Method | Resource Path                     | Users with access |
|--------------------|--------|-----------------------------------|-------------------|
| CreateSubscription | POST   | /regions/{regionId}/subscriptions | All users         |
| ListSubscription   | GET    | /subscriptions                    | All users         |
| DeleteSubscription | GET    | /subscriptions/{subscriptionId}   | All users         |


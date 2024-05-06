# Regions Module Authentication & Authorization

Authentication of users is carried out using Amazon Cognito, and authorization of users using [Amazon Verified Permissions](https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/what-is-avp.html).

Users within Cognito are assigned a role of `admin`, `contributor`, or `reader`.

## REST API Authorization

The following actions and permissions are configured:

| Action        | Method | Resource Path                | Users with access |
|---------------|--------|------------------------------|-------------------|
| CreateGroup   | POST   | /groups                      | Contributor       |
| ListGroups    | GET    | /groups                      | All users         |
| DescribeGroup | GET    | /groups/{groupId}            | All users         |
| DeleteGroup   | DELETE | /groups/{groupId}            | Admin             |
| UpdateGroup   | PATCH  | /groups/{groupId}            | Contributor       |
| CreateRegion  | POST   | /groups/{groupid}/regions    | Contributor       |
| ListRegions   | GET    | /regions                     | All users         |
| GetRegion     | GET    | /regions/{regionId}          | All users         |
| DeleteRegion  | DELETE | /regions/{regionId}          | Admin             |
| UpdateRegion  | PATCH  | /regions/{regionId}          | Contributor       |
| CreatePolygon | POST   | /regions/{regionId}/polygons | Contributor       |
| ListPolygons  | GET    | /polygons                    | All users         |
| GetPolygon    | GET    | /polygons/{polygonId}        | All users         |
| DeletePolygon | DELETE | /polygons/{polygonId}        | Admin             |
| UpdatePolygon | PATCH  | /polygons/{polygonId}        | Contributor       |
| CreateState   | POST   | /polygons/{polygonId}/states | Contributor       |
| ListStates    | GET    | /states                      | All users         |
| GetState      | GET    | /states/{stateId}            | All users         |
| DeleteState   | DELETE | /states/{stateId}            | Admin             |
| UpdateState   | PATCH  | /states/{stateId}            | Contributor       |

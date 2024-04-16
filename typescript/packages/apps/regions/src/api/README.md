# DynamoDB Access Patterns


Partition key: `pk`
Sort key: `sk`
GSI1 : `siKey1-pk-index`
GSI2 : `type-sk-index`
GSI3 : `siKey2-siKey3-index`


| pk           | sk             | siKey1                    | siKey2     | siKey3      | name   | key   | value   | id        | type |
|--------------|----------------|---------------------------|------------|-------------|--------|-------|---------|-----------|------|
| g:<groupId>  | g:<groupId>    |                           |            |             | <name> |       |         |           | g    |
| g:<groupId>  | tk:___name     | tk:___name:tv:<value>     |            |             |        |       |         |           | tk   |
| g:<groupId>  | tk:<key>       | tk:<key>:tv:<value>       |            |             |        | <key> | <value> |           | tk   |
|              |                |                           |            |             |        |       |         |           |      |
| r:<regionId> | r:<regionId>   |                           |            |             | <name> |       |         |           | r    |
| r:<regionId> | tk:___name     | tk:___name:tv:<value>     |            |             |        |       |         |           | tk   |
| r:<regionId> | tk:___groupId  | tk:___groupId:tv:<value>  |            |             |        |       |         |           | tk   |
| r:<regionId> | tk:<key>       | tk:<key>:tv:<value>       |            |             |        | <key> | <value> |           | tk   |
|              |                |                           |            |             |        |       |         |           |      |
| z:<zoneId>   | z:<zoneId>     |                           |            |             | <name> |       |         |           | z    |
| z:<zoneId>   | tk:___name     | tk:___name:tv:<value>     |            |             |        |       |         |           | tk   |
| z:<zoneId>   | tk:___groupId  | tk:___groupId:tv:<value>  |            |             |        |       |         |           | tk   |
| z:<zoneId>   | tk:___regionId | tk:___regionId:tv:<value> |            |             |        |       |         |           | tk   |
| z:<zoneId>   | tk:<key>       | tk:<key>:tv:<value>       |            |             |        | <key> | <value> |           | tk   |
| z:<zoneId>   | s:___latest    |                           |            |             |        |       |         | <stateId> | zs   |
|              |                |                           |            |             |        |       |         |           |      |
| s:<stateId>  | s:<stateId>    |                           | z:<zoneId> | <timestamp> | <name> |       |         |           | s    |
| s:<stateId>  | tk:___name     | tk:___name:tv:<value>     |            |             |        |       |         |           | tk   |
| s:<stateId>  | tk:<key>       | tk:<key>:tv:<value>       |            |             |        | <key> | <value> |           | tk   |
| s:<stateId>  | tk:___groupId  | tk:___groupId:tv:<value>  |            |             |        |       |         |           | tk   |
| s:<stateId>  | tk:___regionId | tk:___regionId:tv:<value> |            |             |        |       |         |           | tk   |
| s:<stateId>  | tk:___zoneId   | tk:___zoneId:tv:<value>   |            |             |        |       |         |           | tk   |
| s:<stateId>  | tk:___isLatest | tk:___zoneId:tv:<value>   |            |             |        |       |         |           | tk   |


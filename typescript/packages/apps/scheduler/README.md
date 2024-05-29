# Scheduler Module

## Overview

The scheduler module manages the scheduling of engine processing task based on `region` processing configuration listed below:

| Mode         | Description                                                                                |
|--------------|--------------------------------------------------------------------------------------------|
| Scheduled    | Triggers the engine processing job on single or recurrent basis                            |
| On New Scene | Triggers the engine processing job if new sentinel image matched boundary of ARCADE region |
| Disabled     | No processing                                                                              |


## Architecture

### ARCADE Conceptual Architecture

The _scheduler module_ subscribes events from the `Regions` module. When a new region is created with a `scheduled` mode, the _scheduler module_ automatically creates a corresponding single or recurrent schedule for that region.

Additionally, for regions configured with the `onNewScene` option, the scheduler module subscribes to [notifications about new satellite imagery](https://registry.opendata.aws/sentinel-2-l2a-cogs/) from the AWS account managed by Element84. If a newly available satellite image intersects with a region created within ARCADE, the scheduler module triggers the engine processing to handle that new data for the relevant region.

This event-driven architecture allows ARCADE to automate the processing of satellite imagery for specific regions, either on a scheduled basis or in response to the availability of new data, ensuring efficient and timely handling of geospatial data updates.

### Scheduler Logical Architecture

![logical](docs/images/ARCADE%20HLA-scheduler.png)

Amazon EventBridge Scheduler is used to initiate a single or recurring schedule that enqueues a command message into the queue of the `Engine` module. An implementation of the `Engine` module will then retrieve the message from the queue and execute the engine processing within the specified region.

Amazon Simple Queue Service (SQS) is utilized to subscribe to new image notifications originating from the` Sentinel 2 Account`. AWS Lambda will then process the message to verify if any of the ARCADE `Regions` are located within the bounding box of the incoming image and then enqueues a command message into the queue of the `Engine` module. To prevent duplication when processing the region, we will use the combination the region id and image datetime as the SQS [message deduplication ID](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagededuplicationid-property.html).




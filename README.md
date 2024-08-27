# **ARCADE** (Automated Root Cause Analysis and Decision Engine - For Agriculture)

## Solution Overview

Many industries depend upon intelligence and insights gained from earth observation data (satellite imagery, aerial imagery, remote sensing) and processed geospatial data, within their enterprise. Earth observation data, coupled with models (mechanistic and AI-powered), helps customers to improve demand and supply forecasting, automate risk management and mitigation workflows, improve customer outcomes, and improve their ability to meet regulatory requirements.

`AWS ARCADE` removes the undifferentiated heavy lifting that customers face when designing, building, and implementing geospatial and earth observation image processing pipelines and related infrastructure. Common industries that benefit from earth observation and geospatial data processing and analytics include:

- Academia
- Agriculture
- Consumer Packaged Goods
- Energy, Power & Utilities
- Financial Services, Insurance, Finance, Trading, Hedging
- Geospatial
- OEM (Agriculture, Construction, Mining, Off-Road, On-Road, Irrigation, Autonomy, Steering and Guidance)
- Public Sector / Non-Governmental Organizations
- Retail
- Seed and Chemical Manufacturers
- Sustainability

### Success
Upon successful deployment of this solution, you will be able to do the following:
- Enroll polygons (areas of interest, farm fields, geographical areas of land) for processing and analysis
- Schedule the frequency of polygon analysis, for each polygon, to support one-time and recurring automated processing
- Automate the searching, downloading, clipping, and processing of earth observation data into NDVI maps and meta data, per polygon
- Customize, extend, and build upon existing earth observation index calculations to meet your specific use case requirements
- Search and access processed imagery and meta data via an API with user Authentication and Authorization
- Directly search and query processed imagery and meta data via the integrated AWS Services
- Establish customized alerts via Amazon SNS based upon meta data processed for each polygon
- Visualize processed imagery and meta data via an optional but integrated UI
- Integrate, customize, extend and augment existing workflows to achieve business goals


## Prerequisites for Deployment

In order to deploy `ARCADE` from your local workstation, you need to install the following dependencies:

- Active AWS Account
- [AWS Command Line Interface](https://aws.amazon.com/cli/)
- [Docker](https://docs.docker.com/engine/install/)
- [Rush.js](https://rushjs.io/)
- Node.js 20.x
- [pnpm 9.0.2](https://www.npmjs.com/package/pnpm/v/9.0.2)
- [tsx](https://www.npmjs.com/package/tsx/v/4.18.0)
- It may be necessary to bootstrap your AWS environment. Bootstrapping is the process of preparing your AWS environment for usage with the AWS Cloud Development Kit (AWS CDK). Before you deploy a CDK stack into an AWS environment, the environment must first be bootstrapped. For more information about bootstrapping, please review the following:
    - https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html
    - https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html
- NOTE: AWS ARCADE includes an optional UI module. The optional and integrated UI module includes functionality provided by Amazon Location Service. As of 7/24, Amazon Location Service is not available in certain AWS Regions, including us-west-1. Please review the most current list of Region availability of Amazon Location Service to ensure the optional UI module can be deployed within a Region that meets your company requirements.

## Deployment

### 1. Clone the solution

Run the following command to clone the solution repository into your local workstation:

```shell
$ git clone https://github.com/aws-solutions-library-samples/guidance-for-aws-arcade
$ cd guidance-for-aws-arcade
$ export ARCADE_FOLDER=$PWD
$ export CLI_FOLDER="$(PWD)/typescript/packages/apps/cli"
```

### 2. Bundle the artifact from `Stac-server` repository

ARCADE conforms to the [STAC specification](https://github.com/radiantearth/stac-spec/blob/master/item-spec/item-spec.md) and generates [STAC item](https://github.com/radiantearth/stac-spec/blob/master/item-spec/item-spec.md) as a result of the analysis. It stores these analysis results in [Stac-server](https://github.com/stac-utils/stac-server). To make the deployment simpler, we port the infrastructure definition from `serverless` framework to `cdk`. Run the following command to bundle `Stac-server` NodeJS application codes which are referred by the [StacServer](infrastructure/src/stacServer/stacServer.stack.ts) stack

```shell
$ cd $ARCADE_FOLDER
$ git clone --depth 1 --branch v3.8.0 https://github.com/stac-utils/stac-server.git
$ cd stac-server && npm install && npm run build
$ cp dist/api/api.zip $ARCADE_FOLDER/infrastructure/src/stacServer/lambdas && cp dist/ingest/ingest.zip $ARCADE_FOLDER/infrastructure/src/stacServer/lambdas

```

### 3. Build the solution

Run the following command to install the solution dependencies and build it:

```shell
$ cd $ARCADE_FOLDER
$ rush update
$ rush build
```

### 4. Deploy the solution

Setup some environment variables which will be referenced by rest of the commands. Replace the following variables with the actual value.

| Name                               | Description                                                                                                           |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| ARCADE_ENVIRONMENT                 | Environment (.e.g dev, stage or prod). You can have multiple environment deployed in the same AWS account and region. |
| ARCADE_ADMINISTRATOR_EMAIL         | Administrator's email.                                                                                                |
| ARCADE_ADMINISTRATOR_MOBILE_NUMBER | Administrator's phone number (including the area code, e.g. +61xxxxxx).                                               |
| AWS_REGION                         | ARCADE's AWS Region deployment.                                                                                       |


```shell
$ export ARCADE_ADMINISTRATOR_EMAIL=<ARCADE_ADMINISTRATOR_EMAIL>
$ export ARCADE_ADMINISTRATOR_MOBILE_NUMBER=<ARCADE_ADMINISTRATOR_MOBILE_NUMBER>
$ export ARCADE_ENVIRONMENT=<ARCADE_ENVIRONMENT>
$ export AWS_REGION=<AWS_REGION>
```

Run the following command to start the installation of ARCADE:

```shell
$ cd $ARCADE_FOLDER/infrastructure
$ npm run cdk -- deploy --concurrency=10 --require-approval never  -c environment=$ARCADE_ENVIRONMENT -c administratorEmail=$ARCADE_ADMINISTRATOR_EMAIL -c administratorPhoneNumber=$ARCADE_ADMINISTRATOR_MOBILE_NUMBER --all
```

### 5. Deploy the UI

Run the following the bundle the Web UI assets and upload it to the web artifact buckets:

```shell
$ cd $ARCADE_FOLDER/typescript/packages/apps/ui
$ npm run deploy
```

### 6. Set your initial password

Run the following command to set the password for the administrator user (replace the `<PASSWORD>` with your own) :

```shell
export USER_POOL_ID=$(aws ssm get-parameter --name "/arcade/$ARCADE_ENVIRONMENT/shared/cognitoUserPoolId" --query "Parameter.Value" --output text)

aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID  --username $ARCADE_ADMINISTRATOR_EMAIL --password <PASSWORD> --permanent
```


## Next Steps

- [Walkthrough](docs/walkthrough.md)
- [Regions Module](typescript/packages/apps/regions)
- [Executor Module](typescript/packages/apps/executor)
- [Notifications Module](typescript/packages/apps/notifications)
- [Results Module](typescript/packages/apps/results)
- [Scheduler Module](typescript/packages/apps/scheduler)
- [Regions Extension Module](typescript/packages/apps/regions-extension)
- [UI Module](typescript/packages/apps/ui)
- [Integration Tests](typescript/packages/integration-tests)







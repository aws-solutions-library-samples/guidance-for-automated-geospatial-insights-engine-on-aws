# **ARCADE** (Agricultural Root Cause Analysis and Decision Engine )

## Solution Overview

`AWS ARCADE` removes the undifferentiated heavy lifting that customers face when designing, building, and implementing decision support technologies, and improving work-order management, supply chain, and logistics management systems in agriculture.

## Prerequisites for Deployment

In order to deploy `ARCADE` from your local workstation, you need to install the following dependencies:

- [AWS Command Line Interface](https://aws.amazon.com/cli/)
- [Docker](https://docs.docker.com/engine/install/)
- [Rush.js](https://rushjs.io/)
- Node.js 20.x

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
$ git clone --depth 1 --branch  v3.8.0  https://github.com/stac-utils/stac-server.git
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
| ARCADE_REGION                      | Solution's AWS Region deployment.                                                                                     |
| ARCADE_ADMINISTRATOR_MOBILE_NUMBER | Administrator's phone number (including the area code, e.g. +61xxxxxx).                                               |


```shell
$ export ARCADE_ADMINISTRATOR_EMAIL=<ARCADE_ADMINISTRATOR_EMAIL>
$ export ARCADE_ADMINISTRATOR_MOBILE_NUMBER=<ARCADE_ADMINISTRATOR_MOBILE_NUMBER>
$ export ARCADE_ENVIRONMENT=<ARCADE_ENVIRONMENT>
$ export ARCADE_REGION=<ARCADE_REGION>
```

Run the following command to output the help command of the installer:
```shell
$ cd $CLI_FOLDER
$ sudo bin/run.js install --help
Install ARCADE for the specified environment

USAGE
  $ arcade install -e <value> -r <value> -a <value> -n <value> [--json] [-l <value>]

FLAGS
  -a, --administratorEmail=<value>        (required) The administrator Email address
  -e, --environment=<value>               (required) The environment used to deploy the arcade project to
  -l, --role=<value>                      The RoleArn for the CLI to assume for deployment
  -n, --administratorPhoneNumber=<value>  (required) Enter the administrator phone number, including + and the country code, for example +12065551212.
  -r, --region=<value>                    (required) The AWS Region arcade is deployed to

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Install ARCADE for the specified environment

EXAMPLES
  $ arcade install -e stage -r us-west-2 -a dummyEmail@test.com -n +614xxxxxxxx
```

Run the following command to start the installation of ARCADE:

```shell
$ bin/run install -e $ARCADE_ENVIRONMENT -r $ARCADE_REGION -n $ARCADE_ADMINISTRATOR_MOBILE_NUMBER -a $ARCADE_ADMINISTRATOR_EMAIL
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







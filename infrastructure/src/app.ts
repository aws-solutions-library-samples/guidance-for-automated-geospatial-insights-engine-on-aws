#!/usr/bin/env node
/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { getOrThrow, tryGetBooleanContext } from '@agie/cdk-common';
import * as cdk from 'aws-cdk-lib';
import { App } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EngineStack } from './engine/engine.stack.js';
import { RegionsApiStack } from './regions/regions.stack.js';
import { RegionsExtensionStack } from './regionsExtension/regionsExtension.stack.js';
import { SharedInfrastructureStack } from './shared/shared.stack.js';
import { verifiedPermissionsPolicyStoreIdParameter } from './shared/verifiedPermissions.construct.js';
import { StacServerStack } from './stacServer/stacServer.stack.js';
import { ResultsStack } from './results/results.stack.js';
import { SchedulerStack } from './scheduler/scheduler.stack.js';
import { NotificationsStack } from './notifications/notifications.stack.js';
import { UIApiStack } from './ui/ui.stack.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new App();

// mandatory config
const environment = getOrThrow(app, 'environment');
const administratorEmail = getOrThrow(app, 'administratorEmail');
const administratorPhoneNumber = getOrThrow(app, 'administratorPhoneNumber');

// optional requirements? SES related
const cognitoFromEmail = app.node.tryGetContext('cognitoFromEmail') as string;
const cognitoVerifiedDomain = app.node.tryGetContext('cognitoVerifiedDomain') as string;
const cognitoFromName = app.node.tryGetContext('cognitoFromName') as string;
const cognitoReplyToEmail = app.node.tryGetContext('cognitoReplyToEmail') as string;

// optional concurrency limit used by the executor module when uploading polygon input files for region processing
const concurrencyLimit = parseInt(app.node.tryGetContext('concurrencyLimit') ?? 10);

// optional configuration for STAC OpenSearch servers
const stacServerInstanceType = app.node.tryGetContext('stacServerInstanceType') as string ?? 'c5.large.search';
const stacServerVolumeType = app.node.tryGetContext('stacServerVolumeType') as string ?? 'gp3';
const stacServerVolumeSize = parseInt(app.node.tryGetContext('stacServerVolumeSize') ?? 20);
const stacServerInstanceCount = parseInt(app.node.tryGetContext('stacServerInstanceCount') ?? 1);
const stacServerDedicatedMasterEnabled = tryGetBooleanContext(app, 'stacServerDedicatedMasterEnabled', false);
const stacServerZoneAwarenessEnabled = tryGetBooleanContext(app, 'stacServerZoneAwarenessEnabled', false);

// optional requirement to remove bucket and objects when it got deleted
const deleteBucket = tryGetBooleanContext(app, 'deleteBucket', false);

// Sentinel-2 Open Data on AWS parameters
const sentinelTopicArn = app.node.tryGetContext('sentinelTopicArn') as string ?? 'arn:aws:sns:us-west-2:608149789419:cirrus-es-prod-publish';
const sentinelApiUrl = app.node.tryGetContext('sentinelApiUrl') as string ?? 'https://earth-search.aws.element84.com/v1';
const sentinelCollection = app.node.tryGetContext('sentinelCollection') as string ?? 'sentinel-2-c1-l2a';

// user VPC config
const useExistingVpc = tryGetBooleanContext(app, 'useExistingVpc', false);

// useRegionCache
const useRegionCache = tryGetBooleanContext(app, 'useRegionCache', false);

let userVpcId;
let userIsolatedSubnetIds;
let userPrivateSubnetIds;
let userPublicSubnetIds;
let userAvailabilityZones;
if (useExistingVpc) {
	userVpcId = getOrThrow(app, 'existingVpcId');
	userIsolatedSubnetIds = getOrThrow(app, 'existingIsolatedSubnetIds').toString().split(',');
	userPrivateSubnetIds = getOrThrow(app, 'existingPrivateSubnetIds').toString().split(',');
	userPublicSubnetIds = getOrThrow(app, 'existingPublicSubnetIds').toString().split(',');
	userAvailabilityZones = getOrThrow(app, 'userAvailabilityZones').toString().split(',');
}

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const stackName = (suffix: string) => `agie-${environment}-${suffix}`;
const stackDescription = (moduleName: string) => `Infrastructure for AGIE ${moduleName} module`;

const deployPlatform = (callerEnvironment?: {
	accountId?: string;
	region?: string
}): void => {
	const sharedStack = new SharedInfrastructureStack(app, 'SharedStack', {
		stackName: stackName('shared'),
		description: stackDescription('Shared'),
		environment,
		administratorEmail,
		administratorPhoneNumber,
		deleteBucket,
		userVpcConfig: useExistingVpc ? {
			availabilityZones: userAvailabilityZones,
			privateSubnetIds: userPrivateSubnetIds,
			publicSubnetIds: userPublicSubnetIds,
			isolatedSubnetIds: userIsolatedSubnetIds,
			vpcId: userVpcId
		} : undefined,
		userPoolEmail:
			cognitoFromEmail !== undefined
				? {
					fromEmail: cognitoFromEmail,
					fromName: cognitoFromName,
					replyTo: cognitoReplyToEmail,
					sesVerifiedDomain: cognitoVerifiedDomain
				}
				: undefined,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});

	const regionsStack = new RegionsApiStack(app, 'RegionsModule', {
		stackName: stackName('regions'),
		description: stackDescription('Regions'),
		environment,
		policyStoreIdParameter: verifiedPermissionsPolicyStoreIdParameter(environment),
		vpc: sharedStack.vpc,
		useRegionCache,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});

	regionsStack.addDependency(sharedStack);

	const regionsExtensionStack = new RegionsExtensionStack(app, 'RegionsExtensionModule', {
		stackName: stackName('regionsExtension'),
		description: stackDescription('RegionsExtension'),
		environment,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});

	regionsExtensionStack.addDependency(regionsStack);

	const stacServerStack = new StacServerStack(app, 'StacServerModule', {
		stackName: stackName('stacServer'),
		description: stackDescription('StacServer initializer'),
		environment,
		volumeSize: stacServerVolumeSize,
		volumeType: stacServerVolumeType,
		instanceType: stacServerInstanceType,
		instanceCount: stacServerInstanceCount,
		dedicatedMasterEnabled: stacServerDedicatedMasterEnabled,
		zoneAwarenessEnabled: stacServerZoneAwarenessEnabled,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});
	stacServerStack.addDependency(sharedStack);

	const engineStack = new EngineStack(app, 'EngineModule', {
		stackName: stackName('engine'),
		description: stackDescription('Engine'),
		environment,
		vpc: sharedStack.vpc,
		stacApiEndpoint: stacServerStack.stacApiEndpoint,
		stacApiResourceArn: stacServerStack.stacApiResourceArn,
		sentinelApiUrl,
		sentinelCollection,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});

	engineStack.addDependency(sharedStack);

	const resultStack = new ResultsStack(app, 'ResultsModule', {
		stackName: stackName('results'),
		description: stackDescription('Results module stack'),
		environment,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		},
		stacServerTopicArn: stacServerStack.stacIngestTopicArn,
		stacApiEndpoint: stacServerStack.stacApiEndpoint,
		stacApiResourceArn: stacServerStack.stacApiResourceArn
	});

	resultStack.addDependency(sharedStack);
	resultStack.addDependency(regionsStack);

	const schedulerStack = new SchedulerStack(app, 'SchedulerModule', {
		stackName: stackName('scheduler'),
		description: stackDescription('Scheduler'),
		environment,
		concurrencyLimit,
		sentinelTopicArn,
		stacApiEndpoint: stacServerStack.stacApiEndpoint,
		stacApiResourceArn: stacServerStack.stacApiResourceArn,
		sentinelApiUrl,
		sentinelCollection,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});

	schedulerStack.addDependency(sharedStack);
	schedulerStack.addDependency(engineStack);
	schedulerStack.addDependency(regionsStack);
	schedulerStack.addDependency(resultStack);

	const notificationsStack = new NotificationsStack(app, 'NotificationsModule', {
		stackName: stackName('notifications'),
		description: stackDescription('Notifications'),
		environment
	});

	notificationsStack.addDependency(sharedStack);
	notificationsStack.addDependency(regionsStack);

	const uiStack = new UIApiStack(app, 'UIModule', {
		stackName: stackName('ui'),
		description: stackDescription('UI'),
		environment,
		stacApiEndpoint: stacServerStack.stacApiEndpoint,
		stacApiResourceArn: stacServerStack.stacApiResourceArn,
		env: {
			region: callerEnvironment?.region,
			account: callerEnvironment?.accountId
		}
	});
	uiStack.addDependency(sharedStack);
};

const getCallerEnvironment = ():
	| {
	accountId?: string;
	region?: string;
}
	| undefined => {
	if (!fs.existsSync(`${__dirname}/predeploy.json`)) {
		throw new Error(
			'Pre deployment file does not exist\n' +
			'Make sure you run the cdk using npm script which will run the predeploy script automatically\n' +
			'EXAMPLE\n' +
			'$ npm run cdk deploy -- -e sampleEnvironment'
		);
	}
	const { callerEnvironment } = JSON.parse(fs.readFileSync(`${__dirname}/predeploy.json`, 'utf-8'));
	return callerEnvironment;
};

deployPlatform(getCallerEnvironment());

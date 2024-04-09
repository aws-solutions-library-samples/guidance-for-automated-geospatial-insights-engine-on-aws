#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { SharedPlatformInfrastructureStack } from './shared/sharedPlatform.stack.js';
import { AwsSolutionsChecks } from 'cdk-nag';
import { tryGetBooleanContext } from '@arcade/cdk-common';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new cdk.App();

const deleteBucket = tryGetBooleanContext(app, 'deleteBucket', false);

Aspects.of(app).add(new AwsSolutionsChecks({verbose: true}));

const stackNamePrefix = `arcade`;

const stackName = (suffix: string) => `${stackNamePrefix}-${suffix}`;
const stackDescription = (moduleName: string) => `Infrastructure for ${moduleName} module`;

const deployPlatform = (callerEnvironment?: { accountId?: string, region?: string }): void => {

new SharedPlatformInfrastructureStack(app, 'SharedPlatformStack', {
        stackName: stackName('sharedPlatform'),
        description: stackDescription('SharedPlatform'),
        deleteBucket,
        env: {
            // The ARCADE_REGION domain variable
            region: process.env?.['ARCADE_REGION'] || callerEnvironment?.region,
            account: callerEnvironment?.accountId
        }
    });

       
};

const getCallerEnvironment = (): { accountId?: string, region?: string } | undefined => {
    if (!fs.existsSync(`${__dirname}/predeploy.json`)) {
        throw new Error('Pre deployment file does not exist\n' +
            'Make sure you run the cdk using npm script which will run the predeploy script automatically\n' +
            'EXAMPLE\n' +
            '$ npm run cdk deploy -- -e sampleEnvironment');
    }
    const {callerEnvironment} = JSON.parse(fs.readFileSync(`${__dirname}/predeploy.json`, 'utf-8'));
    return callerEnvironment;
};

deployPlatform(getCallerEnvironment());

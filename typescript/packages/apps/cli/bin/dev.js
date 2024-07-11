#!/usr/bin/env tsx --trace-warnings

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
import path from 'path';
import oclif from '@oclif/core';
import { fileURLToPath } from 'url';
import tsNode from 'ts-node';
import dotenv from 'dotenv';
import loadValidatorFunction from './validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const project = path.join(__dirname, '../', 'tsconfig.json');

// In dev mode -> use ts-node and dev plugins
process.env.NODE_ENV = 'development';

tsNode.register({ project });

// In dev mode, always show stack traces
oclif.settings.debug = true;

loadValidatorFunction();

// Start the CLI
await oclif.execute({ development: true, dir: project });

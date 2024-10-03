#!/usr/bin/env npx tsx --trace-warnings

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
import oclif from '@oclif/core';
import path from 'path';
import tsNode from 'ts-node';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const project = path.join(__dirname, '../', 'tsconfig.json');

// In dev mode -> use ts-node and dev plugins
process.env.NODE_ENV = 'development';

tsNode.register({ project });

// In dev mode, always show stack traces
oclif.settings.debug = true;

// Start the CLI
await oclif.execute({ development: true, dir: project });

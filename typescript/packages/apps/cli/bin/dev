#!/usr/bin/env tsx --trace-warnings
import path from 'path';
import oclif from '@oclif/core';
import { fileURLToPath } from 'url';
import tsNode from 'ts-node';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const project = path.join(__dirname, '../', 'tsconfig.json');

// In dev mode -> use ts-node and dev plugins
process.env.NODE_ENV = 'development';

tsNode.register({ project });

// In dev mode, always show stack traces
oclif.settings.debug = true;

import loadValidatorFunction from './validator';
loadValidatorFunction();

// Start the CLI
await oclif.execute({ development: true, dir: project });

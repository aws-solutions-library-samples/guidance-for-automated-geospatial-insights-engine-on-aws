
import { getAwsEnvironment } from '@arcade/cdk-common';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caller environment
const callerEnvironment = await getAwsEnvironment();

fs.writeFileSync(`${__dirname}/predeploy.json`, JSON.stringify({ callerEnvironment }));

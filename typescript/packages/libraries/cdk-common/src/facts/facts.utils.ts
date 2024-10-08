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

import { Fact } from 'aws-cdk-lib/region-info';
import { factMappings, RegionMapping } from './fact-tables.js';

function registerFact(factName: string, regionMapping: RegionMapping) {
	for (const [region, value] of Object.entries(regionMapping)) {
		Fact.register({
			region,
			name: factName,
			value: value,
		});
	}
}
export function registerAllFacts(): void {
	for (const [factName, regionMapping] of Object.entries(factMappings)) {
		registerFact(factName, regionMapping);
	}
}

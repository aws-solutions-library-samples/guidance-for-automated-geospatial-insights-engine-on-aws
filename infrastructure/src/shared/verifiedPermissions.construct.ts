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

import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CfnPolicy, CfnPolicyStore } from 'aws-cdk-lib/aws-verifiedpermissions';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VerifiedPermissionsProperties {
	environment: string;
}

export const verifiedPermissionsPolicyStoreIdParameter = (environment: string) => `/agie/${environment}/shared/verifiedPermissionsPolicyStoreId`;

export class VerifiedPermissions extends Construct {
	public readonly policyStoreId: string;

	constructor(scope: Construct, id: string, props: VerifiedPermissionsProperties) {
		super(scope, id);

		const policySchemaString = readFileSync(path.join(__dirname, 'verifiedPermissionsConfig', 'schema.json')).toString();

		/* policy store */
		const policyStore = new CfnPolicyStore(this, 'PolicyStore', {
			validationSettings: {
				mode: 'STRICT',
			},
			schema: {
				cedarJson: policySchemaString,
			},
		});
		this.policyStoreId = policyStore.attrPolicyStoreId;

		new ssm.StringParameter(this, 'policyStoreId', {
			parameterName: verifiedPermissionsPolicyStoreIdParameter(props.environment),
			stringValue: policyStore.attrPolicyStoreId,
		});

		/** policies */
		/*
		 * Semgrep issue https://sg.run/OPqk
		 * Ignore reason: This is not an input that is provided by end user
		 */
		// nosemgrep
		const loadPolicyFile = (filename: string): string => readFileSync(path.join(__dirname, 'verifiedPermissionsConfig', filename)).toString();

		['Regions', 'Results', 'Notifications', 'Executor', 'Engines'].forEach((module) => {
			new CfnPolicy(this, `${module}AdminPermissions`, {
				definition: {
					static: {
						statement: loadPolicyFile(`${module.toLowerCase()}.admin.cedar`),
						description: `Admin permissions for ${module}`,
					},
				},
				policyStoreId: this.policyStoreId,
			});
			new CfnPolicy(this, `${module}ContributorPermissions`, {
				definition: {
					static: {
						statement: loadPolicyFile(`${module.toLowerCase()}.contributor.cedar`),
						description: `Contributor permissions for ${module}`,
					},
				},
				policyStoreId: this.policyStoreId,
			});
			new CfnPolicy(this, `${module}ReaderPermissions`, {
				definition: {
					static: {
						statement: loadPolicyFile(`${module.toLowerCase()}.reader.cedar`),
						description: `Reader permissions for ${module}`,
					},
				},
				policyStoreId: this.policyStoreId,
			});
		});
	}
}

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

export const verifiedPermissionsPolicyStoreIdParameter = (environment: string) => `/arcade/${environment}/shared/verifiedPermissionsPolicyStoreId`;

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
		const loadPolicyFile = (filename: string): string => readFileSync(path.join(__dirname, 'verifiedPermissionsConfig', filename)).toString();
		new CfnPolicy(this, 'AdminPermissions', {
			definition: {
				static: {
					statement: loadPolicyFile('admin.cedar'),
					description: 'Admin permissions',
				},
			},
			policyStoreId: this.policyStoreId,
		});
		new CfnPolicy(this, 'ContributorPermissions', {
			definition: {
				static: {
					statement: loadPolicyFile('contributor.cedar'),
					description: 'Contributor permissions',
				},
			},
			policyStoreId: this.policyStoreId,
		});
		new CfnPolicy(this, 'ReaderPermissions', {
			definition: {
				static: {
					statement: loadPolicyFile('reader.cedar'),
					description: 'Reader permissions',
				},
			},
			policyStoreId: this.policyStoreId,
		});
	}
}

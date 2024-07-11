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

import { StatusIndicator } from '@cloudscape-design/components';

export default function ({ status }: { status: 'succeeded' | 'failed' | string | undefined | null }) {
	switch (status) {
		case 'succeeded':
			return <StatusIndicator type="success">Succeeded</StatusIndicator>;
		case 'in-progress':
			return <StatusIndicator type="in-progress">In progress</StatusIndicator>;
		case 'pending':
			return <StatusIndicator type="pending">Pending</StatusIndicator>;
		case 'failed':
			return <StatusIndicator type="error">Failed</StatusIndicator>;
		default:
			return '-';
	}
}

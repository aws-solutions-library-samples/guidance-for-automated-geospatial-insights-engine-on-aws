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

import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../shared/Breadcrumbs';
import Shell from '../../shared/Shell';
import FarmsTable from './FarmsTable';

export default function ListFarms() {
	const { growerId } = useParams();
	const breadcrumbsItems = [{ text: 'Farms', href: '/farms' }];
	if (growerId) {
		breadcrumbsItems.unshift({ text: 'Growers', href: '/growers' }, { text: growerId, href: `/growers/${growerId}` });
	}

	return <Shell breadcrumbs={<Breadcrumbs items={breadcrumbsItems} />} contentType="table" content={<FarmsTable growerId={growerId} variant="full-page" />} />;
}

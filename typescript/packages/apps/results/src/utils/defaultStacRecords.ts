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

import { Collection, StacItem, Catalog } from '@agie/events';

export class DefaultStacRecords {
	public defaultCatalog: Catalog;
	public defaultCollection: Collection;
	public defaultStacItem: StacItem;
	public constructor() {
		this.defaultCatalog = {
			id: '',
			type: 'Catalog',
			stac_version: '1.0.0',
			links: [],
			description: '',
			title: '',
		};
		this.defaultCollection = {
			id: '',
			type: 'Collection',
			stac_version: '1.0.0',
			stac_extensions: [
				'https://stac-extensions.github.io/eo/v1.0.0/schema.json',
				'https://stac-extensions.github.io/projection/v1.0.0/schema.json',
				'https://stac-extensions.github.io/view/v1.0.0/schema.json',
			],
			description: '',
			license: 'proprietary',
			extent: {
				spatial: {
					bbox: [],
				},
				temporal: {
					interval: [],
				},
			},
			links: [],
		};
		this.defaultStacItem = {
			id: '',
			collection: '',
			type: 'Feature',
			stac_version: '1.0.0',
			stac_extensions: [],
			geometry: {
				type: 'Polygon',
				coordinates: [null, null],
			},
			bbox: [],
			properties: {
				title: '',
				description: '',
				datetime: '',
				start_datetime: '',
				end_datetime: '',
			},

			links: [],
			assets: {},
		};
	}
}

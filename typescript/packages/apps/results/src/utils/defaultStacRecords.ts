import { Collection, StacItem } from '@arcade/events';

export class DefaultStacRecords {
	public defaultCollection: Collection;
	public defaultStacItem: StacItem;
	public constructor() {
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

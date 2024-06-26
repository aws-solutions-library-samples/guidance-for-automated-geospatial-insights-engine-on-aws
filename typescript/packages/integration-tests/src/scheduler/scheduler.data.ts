import dayjs from "dayjs";

export const SCHEDULER_INTEGRATION_TEST_TAG_KEY = 'created-by-integration-test';
export const SCHEDULER_INTEGRATION_TEST_TAG_VALUE = 'scheduler-module-resources';

export const create_region_body_without_schedule: object = {
	name: 'test-region-1',
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
	processingConfig: {
		mode: 'disabled'
	}
};
export const create_group_body: object = {
	name: 'test-group-1',
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
};
export const create_state_body: object = {
	timestamp: dayjs().toISOString(),
	attributes: {
		estimatedYield: 1026,
	},
	tags: {
		plantedAt: dayjs('2024-03-15').toISOString(),
		crop: 'wheat',
	},
};
export const create_polygon_body: object = {
	name: 'test-polygon-1',
	boundary: [[[
		[
			-104.4895628,
			39.9390518
		],
		[
			-104.492009,
			39.938295
		],
		[
			-104.4926527,
			39.9376369
		],
		[
			-104.494026,
			39.9378015
		],
		[
			-104.4971159,
			39.9367485
		],
		[
			-104.4993046,
			39.9345767
		],
		[
			-104.4992188,
			39.9332933
		],
		[
			-104.4999483,
			39.931615
		],
		[
			-104.4996908,
			39.926909
		],
		[
			-104.4895199,
			39.9268103
		],
		[
			-104.4895628,
			39.9390518
		]
	]]],
	attributes: {
		attr1: 'attr-one',
		attr2: 'attr-two',
	},
	tags: {
		tag2: 'tag-two',
	},
};

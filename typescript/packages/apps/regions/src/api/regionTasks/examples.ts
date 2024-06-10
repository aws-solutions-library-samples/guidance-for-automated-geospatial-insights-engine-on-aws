import { CreateTaskRequestBody, TaskList, TaskResource } from "../../common/tasks/schemas.js";

export const regionTaskPostRequestExample: CreateTaskRequestBody = {
	items: [
		{
			"groupId": "groupId1",
			"name": "region1",
			"processingConfig": {
				"mode": "onNewScene"
			}
		},
		{
			"groupId": "groupId2",
			"name": "region2",
			"processingConfig": {
				"mode": "disabled"
			}
		},
	],
	taskType: "create"
}


export const regionTaskResourceExample: TaskResource = {
	id: 'string',
	taskStatus: 'waiting',
	taskType: 'create',
	statusMessage: 'string',
	progress: 50,
	itemsTotal: 100,
	itemsSucceeded: 99,
	itemsFailed: 1,
	createdAt: '2022-08-30T03:18:26.809Z',
	createdBy: 'someone@somewhere',
}

export const regionTaskListResourceExample: TaskList = {
	tasks: [regionTaskResourceExample]
}


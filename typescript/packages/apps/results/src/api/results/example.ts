import { Result, ResultList } from "./schemas.js";

export const resultListResourceExample: ResultList = {
	"results": [
		{
			"regionId": "01hwvwmm5d2crn4xx8k0s0a61z",
			"id": "01hwy44p6yjpvkdx4c9g675h55",
			"createdAt": "2024-05-03T02:22:16.932Z",
			"engineType": "aws-batch",
			"status": "succeeded",
			"executionId": "56e998fb-8437-4bdb-b378-703481fdee6c",
			"updatedAt": "2024-05-03T02:23:31.334Z",
			"message": "Essential container in task exited"
		}
	],
	"pagination": {
		"count": 20
	}
}

export const resultResourceExample: Result = {
	"regionId": "01hwvwmm5d2crn4xx8k0s0a61z",
	"id": "01hwy44p6yjpvkdx4c9g675h55",
	"createdAt": "2024-05-03T02:22:16.932Z",
	"engineType": "aws-batch",
	"status": "succeeded",
	"executionId": "56e998fb-8437-4bdb-b378-703481fdee6c",
	"updatedAt": "2024-05-03T02:23:31.334Z",
	"message": "Essential container in task exited"
}

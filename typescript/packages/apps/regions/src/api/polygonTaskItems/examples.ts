import { TaskItemList, TaskItemResource } from "../../common/taskItems/schemas.js";

export const taskItemResourceExample: TaskItemResource = {
	name: "testPolygon"
}

export const taskItemListExample: TaskItemList = {
	taskItems: [taskItemResourceExample]
}

import { FastifyBaseLogger } from "fastify";
import { CreateScheduleCommand, CreateScheduleCommandInput, GetScheduleCommand, SchedulerClient, UpdateScheduleCommand } from "@aws-sdk/client-scheduler";
import { CreateScheduleRequest } from "./model.js";
import ow from 'ow';

export class SchedulesService {
	constructor(readonly log: FastifyBaseLogger, private readonly schedulerClient: SchedulerClient, private readonly schedulerGroup: string, private readonly sqsArn: string, private readonly roleArn: string) {
	}

	public async create(request: CreateScheduleRequest): Promise<void> {
		this.log.debug(`SchedulesService> create> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.zoneId, ow.string.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.regionId, ow.string.nonEmpty);
		ow(request.coordinates, ow.array.nonEmpty);
		ow(request.scheduleExpression, ow.string.nonEmpty);
		ow(request.scheduleExpressionTimezone, ow.optional.string);

		const scheduleName = `${request.zoneId}-schedule`

		const schedulePayload: CreateScheduleCommandInput = {
			Name: scheduleName,
			FlexibleTimeWindow: {
				Mode: "OFF"
			},
			ScheduleExpression: request.scheduleExpression,
			ScheduleExpressionTimezone: request.scheduleExpressionTimezone,
			GroupName: this.schedulerGroup,
			Target: {
				Arn: this.sqsArn,
				Input: JSON.stringify(request),
				RoleArn: this.roleArn
			}
		}

		try {
			// check if schedule already exists
			await this.schedulerClient.send(new GetScheduleCommand({Name: scheduleName, GroupName: this.schedulerGroup}))
			// update the schedule if exists
			await this.schedulerClient.send(new UpdateScheduleCommand(schedulePayload))
		} catch (err) {
			if (err instanceof Error && err.name === 'ResourceNotFoundException') {
				// create the schedule
				await this.schedulerClient.send(new CreateScheduleCommand(schedulePayload))
			} else {
				throw err
			}
		}

		this.log.debug(`SchedulesService> start> exit>`);
	}
}

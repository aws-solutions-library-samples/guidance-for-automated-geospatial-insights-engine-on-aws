import { FastifyBaseLogger } from "fastify";
import { CreateScheduleCommand, CreateScheduleCommandInput, DeleteScheduleCommand, GetScheduleCommand, SchedulerClient, UpdateScheduleCommand } from "@aws-sdk/client-scheduler";
import ow from 'ow';
import { RegionResource } from "@arcade/events";

export class SchedulesService {
	constructor(readonly log: FastifyBaseLogger, private readonly schedulerClient: SchedulerClient, private readonly schedulerGroup: string, private readonly sqsArn: string, private readonly roleArn: string) {
	}

	public async delete(request: RegionResource): Promise<void> {
		this.log.debug(`SchedulesService> delete> request:${JSON.stringify(request)}`);
		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		const scheduleName = `${request.id}-schedule`
		try {
			await this.schedulerClient.send(new DeleteScheduleCommand({ Name: scheduleName, GroupName: this.schedulerGroup }))
		} catch (err) {
			if (err instanceof Error && err.name === 'ResourceNotFoundException') {
				// ignore if schedule is no longer there
			} else {
				throw err
			}
		}

		this.log.debug(`SchedulesService> delete> request:${JSON.stringify(request)}`);
	}

	public async create(request: RegionResource): Promise<void> {
		this.log.debug(`SchedulesService> create> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		ow(request.name, ow.string.nonEmpty);

		if (!request.scheduleExpression) {
			this.log.warn(`SchedulesService> create> scheduleExpression is not specified, schedule is not created`)
			return;
		}

		const scheduleName = `${request.id}-schedule`
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
			await this.schedulerClient.send(new GetScheduleCommand({ Name: scheduleName, GroupName: this.schedulerGroup }))
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

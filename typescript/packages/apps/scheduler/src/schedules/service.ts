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

import { DomainEvent, ProcessingConfig, RegionResource } from '@agie/events';
import { CreateScheduleCommand, CreateScheduleCommandInput, DeleteScheduleCommand, GetScheduleCommand, SchedulerClient, UpdateScheduleCommand } from '@aws-sdk/client-scheduler';
import { FastifyBaseLogger } from 'fastify';
import ow from 'ow';

export class SchedulesService {
	constructor(
		readonly log: FastifyBaseLogger,
		readonly schedulerClient: SchedulerClient,
		readonly schedulerGroup: string,
		readonly lambdaArn: string,
		readonly roleArn: string,
		readonly environment: string
	) {}

	private scheduleName(id: string): string {
		return `agie-${this.environment}-${id}-schedule`;
	}

	public async process(event: DomainEvent<RegionResource>): Promise<void> {
		this.log.debug(`SchedulesService> process> event:${JSON.stringify(event)}`);
		// the code below compares the processingConfig of new and old region resource
		// to determine if we need to update the schedule ( when user modified the scheduleExpression or scheduleTimeZone)
		const isEqual = (object1: ProcessingConfig, object2: ProcessingConfig) => {
			const objKeys1 = Object.keys(object1);
			const objKeys2 = Object.keys(object2);
			if (objKeys1.length !== objKeys2.length) return false;
			for (const key of objKeys1) {
				const value1 = object1[key];
				const value2 = object2[key];
				if (value1 !== value2) {
					return false;
				}
			}
			return true;
		};

		const newRegion = event.new;
		const oldRegion = event.old;

		switch (event.eventType) {
			// create schedule for new region
			case 'created':
				ow(newRegion, ow.object.nonEmpty);
				ow(
					newRegion.processingConfig,
					ow.object.partialShape({
						mode: ow.string.nonEmpty,
					})
				);
				if (newRegion.processingConfig.mode === 'scheduled') {
					await this.create(newRegion);
				}
				break;
			// delete schedule for deleted region
			case 'deleted':
				ow(oldRegion, ow.object.nonEmpty);
				ow(
					oldRegion.processingConfig,
					ow.object.partialShape({
						mode: ow.string.nonEmpty,
					})
				);
				await this.delete(oldRegion);
				break;
			case 'updated':
				ow(newRegion, ow.object.nonEmpty);
				ow(
					newRegion.processingConfig,
					ow.object.partialShape({
						mode: ow.string.nonEmpty,
					})
				);
				ow(oldRegion, ow.object.nonEmpty);
				ow(
					oldRegion.processingConfig,
					ow.object.partialShape({
						mode: ow.string.nonEmpty,
					})
				);
				// delete schedule if processing mode set to disabled or scene update
				if (newRegion.processingConfig.mode === 'disabled' || newRegion.processingConfig.mode === 'onNewScene') {
					await this.delete(event.new);
				}
				// create schedule is processing mode set to scheduled
				else if (newRegion.processingConfig.mode === 'scheduled' && !isEqual(newRegion.processingConfig, oldRegion.processingConfig)) {
					await this.create(newRegion);
				}
				break;
		}
		this.log.debug(`SchedulesService> process> exit:`);
	}

	private async delete(request: RegionResource): Promise<void> {
		this.log.debug(`SchedulesService> delete> request:${JSON.stringify(request)}`);
		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		try {
			await this.schedulerClient.send(new DeleteScheduleCommand({ Name: this.scheduleName(request.id), GroupName: this.schedulerGroup }));
		} catch (err) {
			if (err instanceof Error && err.name === 'ResourceNotFoundException') {
				// ignore if schedule is no longer there
			} else {
				throw err;
			}
		}

		this.log.debug(`SchedulesService> delete> request:${JSON.stringify(request)}`);
	}

	private async create(request: RegionResource): Promise<void> {
		this.log.debug(`SchedulesService> create> request:${JSON.stringify(request)}`);

		// validation
		ow(request, ow.object.nonEmpty);
		ow(request.groupId, ow.string.nonEmpty);
		ow(request.id, ow.string.nonEmpty);
		ow(request.name, ow.string.nonEmpty);
		ow(request.processingConfig, ow.object.nonEmpty);
		ow(request.processingConfig.mode, ow.string.nonEmpty);
		ow(request.processingConfig.priority, ow.string.nonEmpty);
		ow(request.processingConfig.scheduleExpression, ow.string.nonEmpty);
		ow(request.processingConfig.scheduleExpressionTimezone, ow.optional.string);

		const scheduleName = this.scheduleName(request.id);
		const schedulePayload: CreateScheduleCommandInput = {
			Name: scheduleName,
			FlexibleTimeWindow: {
				Mode: 'OFF',
			},
			ScheduleExpression: request.processingConfig.scheduleExpression,
			ScheduleExpressionTimezone: request.processingConfig.scheduleExpressionTimezone,
			GroupName: this.schedulerGroup,
			Target: {
				Arn: this.lambdaArn,
				Input: JSON.stringify(request),
				RoleArn: this.roleArn,
			},
		};

		try {
			// check if schedule already exists
			await this.schedulerClient.send(new GetScheduleCommand({ Name: scheduleName, GroupName: this.schedulerGroup }));
			// update the schedule if exists
			await this.schedulerClient.send(new UpdateScheduleCommand(schedulePayload));
		} catch (err) {
			if (err instanceof Error && err.name === 'ResourceNotFoundException') {
				// create the schedule
				await this.schedulerClient.send(new CreateScheduleCommand(schedulePayload));
			} else {
				throw err;
			}
		}

		this.log.debug(`SchedulesService> start> exit>`);
	}
}

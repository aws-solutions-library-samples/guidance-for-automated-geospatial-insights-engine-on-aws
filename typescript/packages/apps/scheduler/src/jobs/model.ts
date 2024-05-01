import { ZoneResource } from "@arcade/events";

export type StartJobRequest = ZoneResource & { scheduleDateTime: string }

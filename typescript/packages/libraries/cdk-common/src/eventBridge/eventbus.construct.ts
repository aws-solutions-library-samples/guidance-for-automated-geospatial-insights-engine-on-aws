import { EventBus } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { eventBusName } from './util.js';

export class Bus extends Construct {
	public readonly eventBusName: string;
	public readonly eventBusArn: string;
	public readonly eventBus: EventBus

	constructor(scope: Construct, id: string) {
		super(scope, id);

		const bus = new EventBus(this, 'EventBus', {
			eventBusName: eventBusName,
		});

		this.eventBus = bus;
		this.eventBusName = bus.eventBusName;
		this.eventBusArn = bus.eventBusArn;
	}
}

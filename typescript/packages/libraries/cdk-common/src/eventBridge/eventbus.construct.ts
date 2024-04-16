import { EventBus } from 'aws-cdk-lib/aws-events';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export const eventBusNameParameter = (environment: string) => `/arcade/${environment}/shared/eventBusName`;
export const eventBusArnParameter = (environment: string) => `/arcade/${environment}/shared/eventBusArn`;

export interface BusConstructProperties {
	environment: string;
	eventBusName: string;
}
export class Bus extends Construct {
	public readonly eventBusName: string;
	public readonly eventBusArn: string;
	public readonly eventBus: EventBus;

	constructor(scope: Construct, id: string, props: BusConstructProperties) {
		super(scope, id);

		const bus = new EventBus(this, 'EventBus', {
			eventBusName: props.eventBusName,
		});

		this.eventBus = bus;
		this.eventBusName = bus.eventBusName;
		this.eventBusArn = bus.eventBusArn;

		new StringParameter(this, `EventBusNameParameter`, {
			parameterName: eventBusNameParameter(props.environment),
			description: `ARCADE event bus name (${props.environment})`,
			stringValue: this.eventBusName,
		});

		new StringParameter(this, `EventBusArnParameter`, {
			parameterName: eventBusArnParameter(props.environment),
			description: `ARCADE event bus arn (${props.environment})`,
			stringValue: this.eventBusArn,
		});
	}
}

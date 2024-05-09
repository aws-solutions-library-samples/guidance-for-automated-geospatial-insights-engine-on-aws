export class SnsUtil {
	readonly TOPIC_PREFIX = 'arcade-events-';

	constructor(readonly region: string,
				readonly accountId: string) {
	}

	public topicName(userId: string) {
		return `${this.TOPIC_PREFIX}${encodeURI(userId)}`;
	}

	public topicArn(userId: string): string {
		return `arn:aws:sns:${this.region}:${this.accountId}:${this.topicName(userId)}`;
	}


}

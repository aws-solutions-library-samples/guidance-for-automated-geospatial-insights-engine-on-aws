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

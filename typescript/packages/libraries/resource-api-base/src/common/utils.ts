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

import type { BaseLogger } from 'pino';
import type { ListIdsPaginationKey, ListIdsPaginationTokenKey } from '../resources/models.js';

export class Utils {
	private readonly log: BaseLogger;

	public constructor(log: BaseLogger) {
		this.log = log;
	}

	public encodeToPaginationToken(from: ListIdsPaginationKey): ListIdsPaginationTokenKey {
		this.log.debug(`Utils > encodeToPaginationToken > in`);
		if (!from?.id) return undefined;

		let buff = new Buffer(`${from.id}:${from.groupId}`);
		let base64data = buff.toString('base64');
		return {
			paginationToken: base64data,
		};
	}

	public decodeFromPaginationToken(from: ListIdsPaginationTokenKey): ListIdsPaginationKey {
		this.log.debug(`Utils > decodeFromPaginationToken > in`);
		if (!from?.paginationToken) return undefined;
		let buff = new Buffer(from.paginationToken, 'base64');
		let [id, groupId] = buff.toString('ascii').split(':');
		return {
			id,
			groupId,
		};
	}
}

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

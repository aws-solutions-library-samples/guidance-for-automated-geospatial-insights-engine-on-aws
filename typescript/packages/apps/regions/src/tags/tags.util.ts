import { BaseLogger } from 'pino';
import { Tags } from '../common/schemas.js';

export interface DiffResult {
	toPut: Tags;
	toDelete: string[];
}

export class TagUtils {
	public constructor(readonly log: BaseLogger) {}

	public expandTagsQS(tagKeyValuePairs: string[]): Tags {
		const expandedTags: Tags = {};
		if ((tagKeyValuePairs?.length ?? 0) > 0) {
			tagKeyValuePairs?.forEach((t) => {
				const kv = t.split(':');
				const k = decodeURIComponent(kv[0] as string);
				const v = decodeURIComponent(kv[1] as string);
				expandedTags[k] = v;
			});
		}
		return expandedTags;
	}

	public diff(existing: Tags = {}, updated: Tags = {}): DiffResult {
		this.log.debug(`tags.utils> diff> in> existing:${JSON.stringify(existing)}, updated:${JSON.stringify(updated)}`);

		const result: DiffResult = {
			toPut: {},
			toDelete: [],
		};

		// add new tags as `toPut`
		Object.entries(updated)
			.filter(([k, _]) => !Object.keys(existing).includes(k))
			.forEach(([k, v]) => (result.toPut[k] = v));

		// add changed tag values as `toPut`
		Object.entries(updated)
			.filter(([k, v]) => existing[k] !== undefined && updated[k] !== null && existing[k] !== v)
			.forEach(([k, v]) => (result.toPut[k] = v));

		// add removed tags to `toDelete` (values of null)
		Object.entries(updated)
			.filter(([_k, v]) => v === null)
			.forEach(([k, _]) => result.toDelete.push(k));

		this.log.debug(`tags.utils> diff> exit:${JSON.stringify(result)}`);
		return result;
	}
}

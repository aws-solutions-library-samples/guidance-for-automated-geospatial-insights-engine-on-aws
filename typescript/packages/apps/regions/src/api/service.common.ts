import { merge } from 'merge-anything';
import ow from 'ow';
import { BaseLogger } from 'pino';
import { ulid } from 'ulid';
import { RESERVED_PREFIX } from '../common/ddbAttributes.util.js';
import { PkType } from '../common/pkTypes.js';
import { Attributes, Tags } from '../common/schemas.js';
import { DiffResult, TagUtils } from '../tags/tags.util.js';
import { CommonRepository, NextToken, ResourceId } from './repository.common.js';

export type ListPaginationOptions = {
	count?: number;
	token?: NextToken;
};

export type TagFilterOptions = ListPaginationOptions & {
	tags?: Tags;
};

const DEFAULT_PAGE_SIZE = 20;

export class CommonService {
	public constructor(readonly log: BaseLogger, readonly commonRepository: CommonRepository, readonly tagUtils: TagUtils) {}

	public prepareResourceForCreate<T, U extends T>(resource: T, reservedAsTags: string[], additional?: unknown, additionalTags?: Tags): U {
		const toSave: U = Object.assign(
			{},
			resource,
			additional,
			{
				id: ulid().toLowerCase(),
				createdAt: new Date(Date.now()).toISOString(),
			},
			{ attributes: { ...resource['attributes'], ...additional?.['attributes'] } }
		);

		// some resource attributes, such as name, are searchable. Save these as a tag.
		if (!toSave['tags']) {
			toSave['tags'] = {};
		}
		for (const tag of reservedAsTags) {
			if (toSave[tag]) {
				const tagKey = `${RESERVED_PREFIX}${tag}`;
				toSave['tags'][tagKey] = toSave[tag];
			}
		}
		if (additionalTags) {
			for (const [key, value] of Object.entries(additionalTags)) {
				toSave['tags'][key] = value;
			}
		}

		return toSave;
	}

	public prepareResourceForUpdate<T, U>(existing: U, updated: T, reservedAsTags: string[], updatedBy: string): [U, DiffResult] {
		const merged = merge(existing, updated) as U;
		merged['updatedAt'] = new Date(Date.now()).toISOString();
		merged['updatedBy'] = updatedBy;

		// Special handling of attributes - providing a  null value means a deletion
		const attributes: Attributes = Object.assign({}, existing['attributes'], updated['attributes']);
		for (const key of Object.keys(attributes)) {
			if (attributes[key] === null) {
				delete attributes[key];
			}
		}
		merged['attributes'] = attributes;

		// determine which tags are to add/delete
		const tagDiff = this.tagUtils.diff(existing['tags'], merged['tags']);

		// some resource attributes, such as name, as searchable. Save these as a tag.
		if (!merged['tags']) {
			merged['tags'] = {};
		}
		for (const tag of reservedAsTags) {
			if (updated[tag] !== existing[tag]) {
				tagDiff.toPut[`${RESERVED_PREFIX}${tag}`] = updated[tag];
			}
		}

		// to avoid any confusion, delete the tags from the resource as this is no longer required once we've identified tag differences
		delete merged['tags'];

		return [merged, tagDiff];
	}

	public async listResourceIdsByTag(keyPrefix: PkType, options: TagFilterOptions): Promise<[ResourceId[], NextToken]> {
		this.log.debug(`CommonService> listResourceIdsByTag> in> keyPrefix:${keyPrefix}:, options: ${JSON.stringify(options)}`);

		ow(options, ow.object.nonEmpty);
		ow(keyPrefix, ow.string.nonEmpty);

		const tagFilterCount = Object.keys(options.tags ?? {}).length ?? 0;
		const pageSize = options.count ?? DEFAULT_PAGE_SIZE;
		const tagKeys = Object.keys(options.tags ?? {});
		const tagValues = Object.values(options.tags ?? {});

		// if tag filter is specified we will query using GSI2 using tag as the key and the filter the result based on the
		// query options whether to include parent/child groups
		const tagFilterQuery = (filterIndex: number, nextToken: string): Promise<[ResourceId[], NextToken]> => {
			this.log.trace(`CommonService> listResourceIdsByTag> tagFilterQuery> filterIndex:${filterIndex}, nextToken:${nextToken}`);
			return this.commonRepository.listResourceIdsByTag(tagKeys[filterIndex], tagValues[filterIndex], keyPrefix, {
				count: pageSize,
				token: nextToken,
			});
		};

		// retrieve the first page of results for each filter
		const resultsForFiltersFutures: Promise<[string[], string]>[] = [];
		for (let filterIndex = 0; filterIndex < tagFilterCount; filterIndex++) {
			resultsForFiltersFutures.push(tagFilterQuery(filterIndex, options.token));
		}

		const resultsForFilters = await Promise.all(resultsForFiltersFutures);
		const idResultsForFilters = resultsForFilters.map(([ids, _paginationKey]) => ids);

		this.log.trace(`CommonService> listResourceIdsByTag> resultsForFilters> resultsForFilters:${JSON.stringify(resultsForFilters)}`);

		// if any of the initial results are empty, then we can exit immediately as no common matches
		for (const ids of idResultsForFilters) {
			if ((ids?.length ?? 0) === 0) {
				this.log.trace(`CommonService> listResourceIdsByTag> early exit`);
				return [undefined, undefined];
			}
		}

		// pointers to help with iterating through the different result sets
		const listPointers = new Array(resultsForFilters.length).fill(0);

		// this inline function will populate new pages of group ids for a specific filter
		let largestMatchGroupId: string;
		const getNextPageOfResults = async (filterIndex: number): Promise<boolean> => {
			this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> filterIndex:${filterIndex}`);
			let paginationKey = resultsForFilters[filterIndex]?.[1];
			this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> paginationKey:${paginationKey}`);

			if (paginationKey === undefined) {
				// no more to process
				this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> early exit 1 (false)`);
				return false;
			}
			if (largestMatchGroupId && largestMatchGroupId > paginationKey) {
				this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> paginationKey ${paginationKey} overridden to ${largestMatchGroupId}`);
				paginationKey = largestMatchGroupId;
			}

			// all subsequent filters are optional filter by tags

			resultsForFilters[filterIndex] = await tagFilterQuery(filterIndex, paginationKey);

			this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> resultsForFilters[filterIndex]: ${JSON.stringify(resultsForFilters[filterIndex])}`);

			if ((resultsForFilters[filterIndex]?.[0]?.length ?? 0) === 0) {
				// no more to process
				this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> early exit 2 (false)`);
				return false;
			} else {
				// store the new page of results, and reset its pointer
				idResultsForFilters[filterIndex] = resultsForFilters[filterIndex]?.[0];
				listPointers[filterIndex] = 0;
				this.log.trace(`CommonService> listResourceIdsByTag> getNextPageOfResults> exit (true)`);
				return true;
			}
		};

		// process each list of group ids per filter, saving where the group id is found across all filter results
		const matched: string[] = [];
		let keepGoing = true;

		while (keepGoing && matched.length < pageSize) {
			for (let filterIndex = 0; filterIndex < tagFilterCount; filterIndex++) {
				this.log.trace(`CommonService> listResourceIdsByTag> filterIndex:${filterIndex}`);
				let currentResourceId = idResultsForFilters?.[filterIndex]?.[listPointers[filterIndex]];
				this.log.trace(`CommonService> listResourceIdsByTag> currentGroupId:${currentResourceId}`);
				if (currentResourceId === undefined) {
					keepGoing = await getNextPageOfResults(filterIndex);
					if (!keepGoing) break;
					currentResourceId = idResultsForFilters?.[filterIndex]?.[listPointers[filterIndex]];
					this.log.trace(`CommonService> listResourceIdsByTag> currentGroupId updated to:${currentResourceId}`);
				}
				// if we reached the last filter index, it means we found a match across all tags
				if (filterIndex === tagFilterCount - 1) {
					this.log.trace(`CommonService> listResourceIdsByTag> found a match across all!`);
					// add the matched id to the result
					matched.push(currentResourceId);
					// increment all the pointers
					listPointers.forEach((_value, index) => listPointers[index]++);
				} else {
					// check for matching group ids between this and the next filter being compared
					let nextGroupId = idResultsForFilters?.[filterIndex + 1]?.[listPointers[filterIndex + 1]];
					this.log.trace(`CommonService> listResourceIdsByTag> nextGroupId:${nextGroupId}`);
					if (nextGroupId === undefined) {
						keepGoing = await getNextPageOfResults(filterIndex + 1);
						if (!keepGoing) break;
						nextGroupId = idResultsForFilters?.[filterIndex + 1]?.[listPointers[filterIndex + 1]];
						this.log.trace(`CommonService> listResourceIdsByTag> nextGroupId updated to:${nextGroupId}`);
					}
					if (currentResourceId === nextGroupId) {
						this.log.trace(`CommonService> listResourceIdsByTag> found partial match so continuing`);
						// group id match, so move onto checking the next filter
						largestMatchGroupId = currentResourceId;
						continue;
					} else if (currentResourceId && nextGroupId && currentResourceId < nextGroupId) {
						// this filter result has a lower group id, therefore increment this filters index
						this.log.trace(`CommonService> listResourceIdsByTag> mismatch. incrementing current point`);
						listPointers[filterIndex]++;
						break;
					} else {
						// the next filter result has a lower group id, therefore increment the next filters index
						this.log.trace(`CommonService> listResourceIdsByTag> mismatch. incrementing next point`);
						listPointers[filterIndex + 1]++;
						break;
					}
				}
			}
		}

		let paginationKey: string;
		if (matched.length >= pageSize) {
			this.log.trace(`CommonService> listResourceIdsByTag> full page of results therefore adding pagination`);
			paginationKey = matched[pageSize - 1];
		}

		const result: [string[], string] = [matched, encodeURIComponent(paginationKey)];
		this.log.debug(`CommonService> listResourceIdsByTag> exit:${JSON.stringify(result)}`);
		return result;
	}
}

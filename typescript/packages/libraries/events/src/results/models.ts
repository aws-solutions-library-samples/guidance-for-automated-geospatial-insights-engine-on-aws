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

/**
 * self: STRONGLY RECOMMENDED. Absolute URL to the Item if it is available at a public URL. This is particularly useful when in a download package that includes metadata, so that the downstream user can know where the data has come from.
 * root: URL to the root STAC entity (Catalog or Collection).
 * parent: URL to the parent STAC entity (Catalog or Collection).
 * collection: STRONGLY RECOMMENDED. URL to a Collection. Absolute URLs should be used whenever possible. The referenced Collection is STRONGLY RECOMMENDED to implement the same STAC version as the Item. A link with this rel type is required if the collection field in properties is present.
 * derived_from: URL to a STAC Item that was used as input data in the creation of this Item.
 * child: URL to a child STAC entity (Catalog or Collection).
 * item: URL to a STAC Item.
 */
export type RelationType = 'self' | 'root' | 'parent' | 'collection' | 'derived_from' | 'child' | 'item';

/**
 * application/geo+json : A STAC item
 * application/json : A STAC Catalog or A STAC Collection
 */
export type MediaType = 'application/geo+json' | 'application/json';

/**
 * thumbnail: An asset that represents a thumbnail of the Item, typically a true color image (for Items with assets in the visible wavelengths), lower-resolution (typically smaller 600x600 pixels), and typically a JPEG or PNG (suitable for display in a web browser). Multiple assets may have this purpose, but it recommended that the type and roles be unique tuples. For example, Sentinel-2 L2A provides thumbnail images in both JPEG and JPEG2000 formats, and would be distinguished by their media types.
 * overview: An asset that represents a possibly larger view than the thumbnail of the Item, for example, a true color composite of multi-band data.
 * data: The data itself. This is a suggestion for a common role for data files to be used in case data providers don't come up with their own names and semantics.
 * metadata: A metadata sidecar file describing the data in this Item, for example the Landsat-8 MTL file.
 */
export type Role = 'thumbnail' | 'overview' | 'data' | 'metadata';

/**
 * Point: "coordinates": [102.0, 0.5]
 * LineString: "coordinates": [[102.0, 0.0],[103.0, 1.0],[104.0, 0.0],[105.0, 1.0]]
 * Polygon: "coordinates": [[[100.0, 0.0],[101.0, 0.0],[101.0, 1.0],[100.0, 1.0],[100.0, 0.0]]]
 */
export type GeometryType =
	'Point'
	| 'MultiPoint'
	| 'LineString'
	| 'MultiLineString'
	| 'Polygon'
	| 'MultiPolygon'
	| 'GeometryCollection';

export interface Geometry {
	type: GeometryType;
	coordinates:
		| [number, number] //Point
		| [[number, number]] //LineString
		| [[[number, number]]]; //Polygon
}

/**
 * The searchable properties of a stac item
 */
export interface Properties {
	/**
	 * The searchable date and time of the assets, which must be in UTC.
	 * It is formatted according to RFC 3339, section 5.6. null is allowed, but requires start_datetime and end_datetime from common metadata to be set.
	 */
	datetime: string | null;
	start_datetime?: string;
	end_datetime?: string;

	/**
	 * Providers should include metadata fields that are relevant for users of STAC, but it is recommended to select only those necessary for search.
	 * Where possible metadata fields should be mapped to the STAC Common Metadata and widely used extensions, to enable cross-catalog search on known fields.
	 */
	[k: string]: unknown;
}

export interface Link {
	/**
	 * The actual link in the format of an URL. Relative and absolute links are both allowed.
	 */
	href: string;
	/**
	 * Relationship between the current document and the linked document. See chapter "Relation types" for more information.
	 */
	rel: RelationType;
	/**
	 * Media type of the referenced entity.
	 * https://github.com/radiantearth/stac-spec/blob/master/catalog-spec/catalog-spec.md#media-types
	 */
	type?: MediaType;
	/**
	 * A human readable title to be used in rendered displays of the link.
	 */
	title?: string;
}

export interface Asset {
	/**
	 * URI to the asset object. Relative and absolute URI are both allowed.
	 */
	href: string;
	/**
	 * The displayed title for clients and users.
	 */
	title?: string;
	/**
	 * A description of the Asset providing additional details, such as how it was processed or created. CommonMark 0.29 syntax MAY be used for rich text representation.
	 */
	description?: string;
	/**
	 * Media type of the asset.
	 */
	type?: MediaType;
	roles?: Role[];

	/**
	 * Attributes enable via extension
	 */
	[k: string]: unknown;
}

export interface Assets {
	[k: string]: Asset;
}

export interface StacItem {
	/**
	 * Provider identifier. The ID should be unique within the Collection that contains the Item.
	 */
	id: string;
	/**
	 * The id of the STAC Collection this Item references
	 */
	collection: string;
	/**
	 * Type of the GeoJSON Object. MUST be set to Feature.
	 */
	type: string;
	/**
	 * The STAC version the Item implements.
	 */
	stac_version: string;
	/**
	 * A list of extensions the Item implements.

	 */
	stac_extensions: string[];
	/**
	 * Defines the full footprint of the asset represented by this item, formatted according to RFC 7946, section 3.1.
	 * The footprint should be the default GeoJSON geometry, though additional geometries can be included.
	 * Coordinates are specified in Longitude/Latitude or Longitude/Latitude/Elevation based on WGS 84.
	 */
	geometry: Geometry;
	/**
	 * Bounding Box of the asset represented by this Item, formatted according to RFC 7946, section 5.
	 */
	bbox: number[];
	/**
	 * A dictionary of additional metadata for the Item.
	 */
	properties: Properties;
	/**
	 * List of link objects to resources and related URLs. A link with the rel set to self is strongly recommended.
	 */
	links: Link[];
	/**
	 * Dictionary of asset objects that can be downloaded, each with a unique key.
	 */
	assets: Assets;
}

/**
 * The object provides information about a provider. A provider is any of the organizations that captures or processes the content of the Collection and therefore influences the data offered by this Collection.
 * May also include information about the final storage provider hosting the data.
 */
export interface Provider {
	/**
	 * The name of the organization or the individual.
	 */
	name: string;
	/**
	 * Multi-line description to add further provider information such as processing details for processors and producers, hosting details for hosts or basic contact information.
	 * CommonMark 0.29 syntax MAY be used for rich text representation.
	 */
	description?: string;
	/**
	 * Roles of the provider. Any of licensor, producer, processor or host.
	 */
	roles?: string[];
	/**
	 * Homepage on which the provider describes the dataset and publishes contact information.
	 */
	url?: string;
}

/**
 * The object describes the spatial extents of the Collection.
 */
export interface Spatial {
	/**
	 * Potential spatial extents covered by the Collection.
	 */
	bbox: number[][];
}

/**
 * The object describes the temporal extents of the Collection.
 */

export interface Temporal {
	/**
	 * Potential temporal extents covered by the Collection.
	 */
	interval: string[][];
}

/**
 * The object describes the spatio-temporal extents of the Collection. Both spatial and temporal extents are required to be specified.
 */
export interface Extent {
	/**
	 * Potential spatial extents covered by the Collection.
	 */
	spatial: Spatial;
	/**
	 * Potential temporal extents covered by the Collection.
	 */
	temporal: Temporal;
}

export interface Catalog {
	/**
	 * Identifier for the Catalog that is unique across the provider.
	 */
	id: string;
	/**
	 *  Set to Catalog if this Catalog only implements the Catalog spec.
	 */
	type: string;
	/**
	 * The STAC version the Catalog implements.
	 */
	stac_version: string;

	/**
	 * A list of extension identifiers the Catalog implements.
	 */
	stac_extensions?: string[];
	/**
	 * A short descriptive one-line title for the Catalog.
	 */
	title?: string;
	/**
	 * Detailed multi-line description to fully explain the Catalog. CommonMark 0.29 syntax MAY be used for rich text representation.
	 */
	description: string;
	/**
	 * List of link objects to resources and related URLs. A link with the rel set to self is strongly recommended.
	 */
	links: Link[];
}

export interface Collection {
	/**
	 * Identifier for the Collection that is unique across the provider.
	 */
	id: string;
	/**
	 *  Must be set to Collection to be a valid Collection.
	 */
	type: string;
	/**
	 * The STAC version the Collection implements.
	 */
	stac_version: string;

	/**
	 * A list of extension identifiers the Collection implements.
	 */
	stac_extensions?: string[];
	/**
	 * A short descriptive one-line title for the Collection.
	 */
	title?: string;
	/**
	 * Detailed multi-line description to fully explain the Collection. CommonMark 0.29 syntax MAY be used for rich text representation.
	 */
	description: string;
	/**
	 * List of keywords describing the Collection.
	 */
	keywords?: string[];
	/**
	 * Collection's license(s), either a SPDX License identifier, various if multiple licenses apply or proprietary for all other cases.
	 */
	license: string;

	/**
	 * A list of providers, which may include all organizations capturing or processing the data or the hosting provider.
	 * Providers should be listed in chronological order with the most recent provider being the last element of the list.
	 */
	providers?: Provider[];
	/**
	 * Spatial and temporal extents.
	 */
	extent: Extent;
	/**
	 * A map of property summaries, either a set of values, a range of values or a JSON Schema.
	 */
	summaries?: {
		[k: string]: unknown
	};
	/**
	 * List of link objects to resources and related URLs. A link with the rel set to self is strongly recommended.
	 */
	links: Link[];
	/**
	 * Dictionary of asset objects that can be downloaded, each with a unique key.
	 */
	assets?: Assets;

	/**
	 * Attributes enable via extension
	 */
	[k: string]: unknown;
}

export interface SearchResult {
	"type": string,
	"stac_version": string,
	"stac_extensions": string[],
	"context": {
		"limit": number,
		"matched": number,
		"returned": number
	},
	"numberMatched": number,
	"numberReturned": number,
	"features": StacItem[]
}

export type Status = 'queued' | 'starting' | 'inProgress' | 'failed' | 'succeeded';

export type EngineType = 'aws-batch';

export interface engineJobCreatedDetails {
	id: string;
	regionId: string;
	status: Status;
	scheduleDateTime: string;
	engineType: EngineType;
	executionId?: string;
	message?: string;
}

export type engineJobUpdatedDetails = Pick<engineJobCreatedDetails, 'id' | 'regionId' | 'status' | 'message'>;

export type engineJobDetails = engineJobCreatedDetails | engineJobUpdatedDetails;

export interface polygonProcessingDetails {
	/**
	 * The id of the step function execution that this metadata belongs to
	 */
	jobId: string;
	/**
	 * Fields are represented as a polygon
	 */
	polygonId: string;
	polygonName: string;
	/**
	 * A grower may own many farms. A grower is represented as a group.
	 */
	groupId: string;
	groupName: string;
	/**
	 * Farms are comprised of many fields. A farm is represented as a region.
	 */
	regionId: string;
	regionName: string;
	/**
	 * The id of the resource that this metadata belongs to.
	 */
	resultId: string;
	/**
	 * The schedule datetime that is being used to query the stac item collections.
	 */
	scheduleDateTime: string;
	/**
	 * The S3 key of the metadata output of the job
	 */
	engineOutputLocation?: string;
}

export interface catalogDetails {
	id: string;
	title: string;
	description: string;
}

export interface groupDetails {
	/**
	 * The id of the group the collection belongs to
	 */
	id: string;
	name: string;
	attributes?: Record<string, any>;
	createdAt: string;
	createdBy: string;
	updatedBy: string;
	updatedAt?: string;
}

export type {
	catalogDetails as CatalogDetails,
	groupDetails as GroupDetails,
	polygonProcessingDetails as PipelineMetadataDetails,
	engineJobDetails as EngineJobDetails,
	engineJobCreatedDetails as EngineJobCreatedDetails,
	engineJobUpdatedDetails as EngineJobUpdatedDetails,
};

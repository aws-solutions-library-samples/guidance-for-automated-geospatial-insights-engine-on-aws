import { Assets, Geometry, Link } from "@arcade/events";

export interface EngineMetadata {

	/**
     * The id of the STAC Collection this Item references
     */
    // collection: string;

	/**
    * Defines the full footprint of the asset represented by this item, formatted according to RFC 7946, section 3.1.
    * The footprint should be the default GeoJSON geometry, though additional geometries can be included.
    * Coordinates are specified in Longitude/Latitude or Longitude/Latitude/Elevation based on WGS 84.
    */
	geometry:Geometry;
	bounding_box:number[];
	 /**
     * List of link objects to resources and related URLs. A link with the rel set to self is strongly recommended.
	 * Only expect links from Sentinal image
     */
	links: Link[];
	assets: Assets;
	/**
    * A dictionary of additional metadata for the Item.
    */
    properties: {
		[k: string]: unknown;
	},

	/**
	 * The stac extensions to be applied to the stac
	 */
	extensions: string[]



}

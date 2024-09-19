# AGIE STAC

## Overview

AGIE manages geographic locations as a `group` / `region` / `zone` / `state` hierarchy. For the AgTech industry this hierarchy is mapped as:

- _Fields_ are represented as a `zone`.
- Over time a field will have many different _crop_ seasons. Each of these crop seasons is represented as a `state` of a `zone`.
- _Farms_ are comprised of many _fields_. A farm is represented as a `region`.
- A _grower_ may own many _farms_. A grower is represented as a `group`.

As AGIE processes satellite imagery, the results are stored in an AGIE specific SpatioTemporal Asset Catalog ([STAC](https://stacspec.org/en)).

## STAC Structure

- All AGIE results are stored within a single STAC Catalog.
- Individual `zones` (e.g. a field) along with their current `state` (e.g. crop details) details are indexed as individual STAC Items.
- `Regions` (e.g. a farm) and `groups` (e.g. a grower) are indexed as [STAC Collections](https://github.com/radiantearth/stac-spec/blob/master/collection-spec/collection-spec.md).

## STAC Collection

### `Group` Collection

- `id`: `group_<groupId>`.
- `extent`:
  - `spatial`: the entire bounding box of the `group`.
  - `temporal`: the timestamps of all processed images within the `group`.
- via `links`, this collection is linked to the root catalog.

**Example:**

```json
{
    "type": "Collection",
    "stac_version": "1.0.0",
    "stac_extensions": [
        "https://stac-extensions.github.io/eo/v1.0.0/schema.json",
        "https://stac-extensions.github.io/projection/v1.0.0/schema.json",
        "https://stac-extensions.github.io/view/v1.0.0/schema.json"
    ],
    "id": "group_yeyd72heu3hd3d",
    "title": "ABC Growers LLC",
    "description": "ABC Growers LLC group.",
    "license": "proprietary",
    "extent": {
        "spatial": {
            "bbox": [
                [
                    -180,
                    -56,
                    180,
                    83
                ]
            ]
        },
        "temporal": {
            "interval": [
                [
                    "2024-04-23T00:00:00Z",
                    "2024-04-24T00:00:00Z",
                    "2024-04-27T00:00:00Z",
                    "2024-04-29T00:00:00Z"
                ]
            ]
        }
    },
    "links": [
        {
            "rel": "self",
            "href": "./group_yeyd72heu3hd3d.json",
            "type": "application/json",
            "title": "ABC Growers LLC"
        },
        {
            "rel": "parent",
            "href": "../catalog.json",
            "type": "application/json",
            "title": "AGIE Catalog"
        },
        {
            "rel": "root",
            "href": "../catalog.json",
            "type": "application/json",
            "title": "AGIE Catalog"
        }
    ]
}

```

> **Question:** Is `extent.spatial` and `extent.temporal` recalculated automatically whenever a new STAC Item is added to a STAC Collection, or do we have to update that manually on zone changes (for `spatial`) and job executions (for `temporal`)?

### `Region` Collection

Identical format to the [Group](#group-collection) Collection with the exception of the following:

- `id`: `region_<groupId>`.
- `links`:
  - `parent`: links to its parent `group`.

**Example:**

```json
{
    ...
    "id": "region_jdywhkdjdu23jd",
    "title": "Barrow Hill Farm",
    "description": "Barrow Hill Farm.",
    "links": [
        {
            "rel": "self",
            "href": "./region_jdywhkdjdu23jd.json",
            "type": "application/json",
            "title": "Barrow Hill Farm"
        },
        {
            "rel": "parent",
            "href": "../group_yeyd72heu3hd3d.json",
            "type": "application/json",
            "title": "ABC Growers LLC group"
        },
        {
            "rel": "root",
            "href": "../catalog.json",
            "type": "application/json",
            "title": "AGIE Catalog"
        }
    ]
}
```

### `Zone` and `State` Item

A `Zone` (e.g. field) and its `State` (e.g. crop) at a specific TOI are represented as a single STAC Item.

- `id`: `<zoneId>_<utc_date>_<utc_time>`.
- `bbox`: the overall bounding box of the `zone`.
- `geometry`: the surrounding polygon of the `zone` boundary.
- `properties`:
  - `eo:cloud_cover`: calculated for the `zone`.
  - `proj:epsg`: `EPSG:4326` that we project our results to.
  - `proj:centroid`: calculated centroid of the `zone`.
  - `s2:degraded_msi_data_percentage`, `s2:nodata_pixel_percentage`, `s2:saturated_defective_pixel_percentage`, `s2:dark_features_percentage`, `s2:cloud_shadow_percentage`, `s2:vegetation_percentage`, `s2:not_vegetated_percentage`, `s2:water_percentage`, `unclassified_percentage`, `s2:medium_proba_clouds_percentage`, `s2:high_proba_clouds_percentage`, `s2:thin_cirrus_percentage`, and `s2:snow_ice_percentage`: statistics calculated based on processed Sentinel `scl` band(s) specific to the `zone` boundary.
  - `agie:*` and `agie_agtech:*` : Refer to [AGIE AgTech Extension](#agie-agtech-extension) for details.
- `collection`: the parent `region` the `zone` belongs to.
- `links`:
  - `self`: links to the STAC Item in context.
  - `collection` and `parent`: links to the parent `region` collection.
  - `root`: links to the root catalog.
  - `group`: links to the `group` that the `zone's` parent `region` belongs to.
  - `derived_from`: the source STAC Items (e.g. uspstream Sentinel STAC Items) used to create this. Note there may be multiple `derived_from` relations due to multiple sources.
- `assets`: (all related specifically to the `zone` boundary)
  - `red`, `green`, `blue`, `nir08`:
    - Clipped bands from the upstream STAC items(s).
    - Includes `eo:bands` and `raster:bands` extensions.
  - `visual`:
    - A true color representation of clipped upstream satellite image.
  - `scl`:
    - Clipped `scl` band from the upstream STAC items(s).
    - Includes `raster:bands` extensions, with `histogram` and `statistics` computed.
  - `scl_surface`:
    - Surface classified pixels only from the  `scl` band.
    - Includes `raster:bands` extensions, with `histogram` and `statistics` computed.
  - `ndvi`:
    - Calculated NDVI.
    - Includes `raster:bands` extensions, with `histogram` and `statistics` computed.
  - `change_detection`:
    - Calculated change detection.
    - Includes `raster:bands` extensions, with `histogram` and `statistics` computed.
  - `nitrogen_metadata`:
    - Results of nitrogen calculation step.

> **Decisions:**
>
> - Instrument details of `platform` (e.g. `sentinel-2b`) and `constellation` (e.g. `sentinel-2`) cannot be added as an AGIE STAC Item may be the result of geomosaiced parent STAC Items meaning multiple possible values (e.g. a single `zone` spanning the boundaries of multiple Sentinel STAC Items but from different platforms `sentinel-2a` and `sentinel-2b`. Also, future requirements will see us enhancing AGIE with results from other instruments too. Due to this, the whole instrument section that includes `instruments` and `gsd` too cannot be included).
> - Parent STAC Item attributes from extensions such as `mgrs`, `grid`, and `view`, not added to the STAC Item due to same issue of AGIE STAC Item being sourced from multiple geo-mosaiced parents.

**Example:**

```json
{
    "stac_version": "1.0.0",
    "stac_extensions": [
        "https://stac-extensions.github.io/eo/v1.0.0/schema.json",
        "https://stac-extensions.github.io/projection/v1.0.0/schema.json",
        "https://stac-extensions.github.io/scientific/v1.0.0/schema.json",
        "https://stac-extensions.github.io/view/v1.0.0/schema.json"
    ],
    "type": "Feature",
    "id": "uytsghdtegandj_20240428_223832",
    "bbox": [
        172.91173669923782,
        1.3438851951615003,
        172.95469614953714,
        1.3690476620161975
    ],
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                [
                    172.91173669923782,
                    1.3438851951615003
                ],
                [
                    172.95469614953714,
                    1.3438851951615003
                ],
                [
                    172.95469614953714,
                    1.3690476620161975
                ],
                [
                    172.91173669923782,
                    1.3690476620161975
                ],
                [
                    172.91173669923782,
                    1.3438851951615003
                ]
            ]
        ]
    },
    "properties": {
        "title": "Barrow Hill Farm - North Field",
        "description": "Results from processing North Field at Barrow Hill Farm on 24/04/28 22:38.",
        "datetime": "2024-04-28T22:38:31.437000Z",
        "created": "2024-04-28T22:38:31.437000Z",
        "updated": "2024-04-28T22:38:31.437000Z",
        "eo:cloud_cover": 1.2,
        "proj:epsg": 4326,
        "proj:centroid": {
            "lat": 40.15384,
            "lon": -104.35563
        },
        "s2:degraded_msi_data_percentage": 0.0212,
        "s2:nodata_pixel_percentage": 0,
        "s2:saturated_defective_pixel_percentage": 0,
        "s2:dark_features_percentage": 0.001145,
        "s2:cloud_shadow_percentage": 0,
        "s2:vegetation_percentage": 37.018913,
        "s2:not_vegetated_percentage": 61.978894,
        "s2:water_percentage": 0.80516,
        "s2:unclassified_percentage": 0.195351,
        "s2:medium_proba_clouds_percentage": 0.000163,
        "s2:high_proba_clouds_percentage": 0.000003,
        "s2:thin_cirrus_percentage": 0.000375,
        "s2:snow_ice_percentage": 0,
        "agie:exclude_geometry": [
            {
                "type": "Polygon",
                "coordinates": [
                    [
                        [
                            172.91173669923782,
                            1.3438851951615003
                        ],
                        [
                            172.95469614953714,
                            1.3438851951615003
                        ],
                        [
                            172.95469614953714,
                            1.3690476620161975
                        ],
                        [
                            172.91173669923782,
                            1.3690476620161975
                        ],
                        [
                            172.91173669923782,
                            1.3438851951615003
                        ]
                    ]
                ]
            },
            {
                "type": "Polygon",
                "coordinates": [
                    [
                        [
                            172.91173669923782,
                            1.3438851951615003
                        ],
                        [
                            172.95469614953714,
                            1.3438851951615003
                        ],
                        [
                            172.95469614953714,
                            1.3690476620161975
                        ],
                        [
                            172.91173669923782,
                            1.3690476620161975
                        ],
                        [
                            172.91173669923782,
                            1.3438851951615003
                        ]
                    ]
                ]
            }
        ],
        "agie:area": 123.23,
        "agie:area_uom": "acres",
        "agie_agtech:crop": "wheat",
        "agie_agtech:planted_at": "2024-04-01"
    },
    "collection": "region_jdywhkdjdu23jd",
    "links": [
        {
            "rel": "self",
            "href": "./uytsghdtegandj_20240428_223832",
            "type": "application/geo+json",
            "title": "Barrow Hill Farm - North Field"
        },
        {
            "rel": "collection",
            "href": "./region_jdywhkdjdu23jd.json",
            "type": "application/json",
            "title": "Barrow Hill Farm"
        },
        {
            "rel": "parent",
            "href": "./region_jdywhkdjdu23jd.json",
            "type": "application/json",
            "title": "Barrow Hill Farm"
        },
        {
            "rel": "root",
            "href": "../catalog.json",
            "type": "application/json",
            "title": "AGIE Catalog"
        },
        {
            "rel": "group",
            "href": "./group_yeyd72heu3hd3d.json",
            "type": "application/json",
            "title": "ABC Growers LLC"
        },
        {
            "rel": "derived_from",
            "href": "https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2B_T13TEE_20230831T174801_L2A",
            "type": "application/geo+json"
        }
    ],
    "assets": {
        "red": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/B04.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Red - 10m",
            "eo:bands": [
                {
                    "name": "B04",
                    "common_name": "red",
                    "center_wavelength": 0.665,
                    "full_width_half_max": 0.038
                }
            ],
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint16",
                    "spatial_resolution": 10,
                    "scale": 0.0001,
                    "offset": -0.1
                }
            ],
            "file:checksum": "12206cb1d84f7a4087f019b7a714046f49d07fa489372c87e4237a505c32e168859b",
            "file:size": 224378263,
            "roles": [
                "data",
                "reflectance"
            ]
        },
        "green": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/B03.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Green - 10m",
            "eo:bands": [
                {
                    "name": "B03",
                    "common_name": "green",
                    "center_wavelength": 0.56,
                    "full_width_half_max": 0.045
                }
            ],
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint16",
                    "spatial_resolution": 10,
                    "scale": 0.0001,
                    "offset": -0.1
                }
            ],
            "file:checksum": "12207d266d1ea9a19d39f7aa742eea8ae72d9933da7c68272796a1b2a96cd1e7e17b",
            "file:size": 219311954,
            "roles": [
                "data",
                "reflectance"
            ]
        },
        "blue": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/B02.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Blue - 10m",
            "eo:bands": [
                {
                    "name": "B02",
                    "common_name": "blue",
                    "center_wavelength": 0.49,
                    "full_width_half_max": 0.098
                }
            ],
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint16",
                    "spatial_resolution": 10,
                    "scale": 0.0001,
                    "offset": -0.1
                }
            ],
            "file:checksum": "1220ab76cde55f5219c6f4330b9f7c904fb49edce2dfcd4862dbe7b6bb2d68448f62",
            "file:size": 218002621,
            "roles": [
                "data",
                "reflectance"
            ]
        },
        "visual": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/TCI.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "True color image",
            "eo:bands": [
                {
                    "name": "B04",
                    "common_name": "red",
                    "center_wavelength": 0.665,
                    "full_width_half_max": 0.038
                },
                {
                    "name": "B03",
                    "common_name": "green",
                    "center_wavelength": 0.56,
                    "full_width_half_max": 0.045
                },
                {
                    "name": "B02",
                    "common_name": "blue",
                    "center_wavelength": 0.49,
                    "full_width_half_max": 0.098
                }
            ],
            "file:checksum": "1220b701c5174481791cd1c24af2b4eb51280b2a082bdf0616f1fcd46c6fbc402e93",
            "file:size": 336062248,
            "roles": [
                "visual"
            ]
        },
        "nir08": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/B08A.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "NIR 2 - 20m",
            "eo:bands": [
                {
                    "name": "B8A",
                    "common_name": "nir08",
                    "center_wavelength": 0.865,
                    "full_width_half_max": 0.033
                }
            ],
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint16",
                    "spatial_resolution": 20,
                    "scale": 0.0001,
                    "offset": -0.1
                }
            ],
            "file:checksum": "1220e97acc2c6d57c3539154065dd4dfc05f07324302eee4acf6dc3541e76c1e39c8",
            "file:size": 60341756,
            "roles": [
                "data",
                "reflectance"
            ]
        },
        "scl": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/SCL.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Scene classification map (SCL)",
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint8",
                    "spatial_resolution": 20,
                    "histogram": [
                        {
                            "count": 12,
                            "min": 0,
                            "max": 11,
                            "buckets": [
                                0,
                                0,
                                0,
                                0,
                                12,
                                56,
                                76,
                                32,
                                19,
                                0,
                                0
                            ]
                        }
                    ],
                    "statistics": {
                        "mean": 4.5,
                        "minimum": 0,
                        "maximum": 11,
                        "stddev": 4,
                        "valid_percent": 100
                    }
                }
            ],
            "file:checksum": "1220ee83738cb446030264d3df0470ff2c5c25d5d87d2aea040c5a359511762b510e",
            "file:size": 3359977,
            "roles": [
                "data"
            ]
        },
        "scl_surface": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/SCL_surface.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Scene classification map (SCL) - surface pixels only",
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint8",
                    "spatial_resolution": 20,
                    "histogram": [
                        {
                            "count": 3,
                            "min": 0,
                            "max": 3,
                            "buckets": [
                                0,
                                0,
                                0,
                                0,
                                12,
                                56,
                                76,
                                32,
                                19,
                                0
                            ]
                        }
                    ],
                    "statistics": {
                        "mean": 0,
                        "minimum": 0,
                        "maximum": 3,
                        "stddev": 0,
                        "valid_percent": 100
                    }
                }
            ],
            "file:checksum": "1220ee83738cb446030264d3df0470ff2c5c25d5d87d2aea040c5a359511762b510e",
            "file:size": 3359977,
            "roles": [
                "data"
            ]
        },
        "ndvi": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/NDVI.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "NDVI",
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint8",
                    "spatial_resolution": 20,
                    "histogram": [
                        {
                            "count": 10,
                            "min": -1,
                            "max": 1,
                            "buckets": [
                                0,
                                0,
                                0,
                                0,
                                12,
                                56,
                                76,
                                32,
                                19,
                                0
                            ]
                        }
                    ],
                    "statistics": {
                        "mean": 0,
                        "minimum": -1,
                        "maximum": 1,
                        "stddev": 0,
                        "valid_percent": 100
                    }
                }
            ],
            "file:checksum": "1220ee83738cb446030264d3df0470ff2c5c25d5d87d2aea040c5a359511762b510e",
            "file:size": 3359977,
            "roles": [
                "data"
            ]
        },
        "change_detection": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/CHANGE_DETECTION.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Change detection based on most recent temporal changes in NDVI.",
            "raster:bands": [
                {
                    "nodata": 0,
                    "data_type": "uint8",
                    "spatial_resolution": 20,
                    "histogram": [
                        {
                            "count": 10,
                            "min": -1,
                            "max": 1,
                            "buckets": [
                                0,
                                0,
                                0,
                                0,
                                12,
                                56,
                                76,
                                32,
                                19,
                                0
                            ]
                        }
                    ],
                    "statistics": {
                        "mean": 0,
                        "minimum": -1,
                        "maximum": 1,
                        "stddev": 0,
                        "valid_percent": 100
                    }
                }
            ],
            "file:checksum": "1220ee83738cb446030264d3df0470ff2c5c25d5d87d2aea040c5a359511762b510e",
            "file:size": 3359977,
            "roles": [
                "data"
            ]
        },
        "nitrogen_metadata": {
            "href": "https://<domain>/<group>/<region>/<zone>/<year>/<month>/<item_id>/nitrogen.json",
            "type": "application/json",
            "file:checksum": "1220a805d0b54f07a37c7b1cb8df5c97011140b026612cf3386c65947137572183d1",
            "file:size": 1491,
            "roles": [
                "metadata"
            ]
        }
    }
}
```

## AGIE AgTech Extension

Industry specific metadata generated by AGIE will each have their own custom extension.

### AGIE General Extensions

#### `agie:exclude_geometry`

Sub polygons within the primary polygon to exclude.

**Example:**

```json
[{
 "type": "Polygon",
 "coordinates": [
  [
   // coordinates of sub polygon 1 to exclude
  ]
 ]
}, {
 "type": "Polygon",
 "coordinates": [
  [
   // coordinates of sub polygon 2 to exclude
  ]
 ]
}]
```

#### `agie:area`

Calculated area of the zone excluding `agie:exclude_geometry`.

#### `agie:area_uom`

UOM (e.g. acres) used in calculating the `zone` area.

### AGIE AgTech Extensions

#### `agie_agtech:crop`

Name of crop planted.

#### `agie_agtech:planted_at`

Date planted.

#### `agie_agtech:harvested_at`

Date harvested.

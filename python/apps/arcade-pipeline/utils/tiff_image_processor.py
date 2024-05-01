import os
import shutil
import hashlib

from utils.ndvi_processor import calculate_statistic_for_histogram


def calculate_checksum(file_path, algorithm):
	hash_obj = getattr(hashlib, algorithm)()
	with open(file_path, "rb") as f:
		while True:
			data = f.read(4096)  # Read the file in chunks
			if not data:
				break
			hash_obj.update(data)
	return hash_obj.hexdigest()


def write_to_tif(output_dir, input_stac_assets, step, band_ids=None):
	tif_assets = {}
	clipped_path_parent = os.path.join(output_dir, "{}".format(step))

	if os.path.exists(clipped_path_parent):
		shutil.rmtree(clipped_path_parent)

	os.makedirs(clipped_path_parent)

	for band in band_ids:
		if input_stac_assets.get(band) is not None:
			tif_file_path = os.path.join(clipped_path_parent, "{}.tif".format(band))
			input_stac_assets[band].rio.to_raster(tif_file_path)
			tif_assets[band] = tif_file_path

	return tif_assets


def create_tif_file_metadata(stac_assets, tif_file_paths, s3_prefix, checksum_algorithm='md5'):
	tif_metadata = {}
	for band, file_path in tif_file_paths.items():
		tif_metadata[band] = {
			"href": "{}/{}.tif".format(s3_prefix, band),
			"type": "image/tiff; application=geotiff; profile=cloud-optimized",
			"title": band,
			"file:checksum": calculate_checksum(file_path, checksum_algorithm),
			"file:size": os.path.getsize(file_path),
			# TODO calculate eo:bands, raster:bands and file metadata from file
			"roles": [
				"data",
				"reflectance"
			]
		}

		# only calculate histogram for these two bands
		if band in ['ndvi', 'ndvi_change']:
			tif_metadata[band]['raster:band'] = calculate_statistic_for_histogram(stac_assets[band])

	return tif_metadata

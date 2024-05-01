import os
import numpy as np
import rasterio
import requests
import boto3
from io import BytesIO


def get_previous_tif(region_id, bounding_box_list):
	arcade_stac_url = os.getenv("ARCADE_STAC_SERVER_URL")
	# Set the API endpoint URL
	url = arcade_stac_url
	# Set the data to be sent in the request body
	data = {
		"collections": ["region_{}".format(region_id)],
		"bbox": bounding_box_list
	}
	# Set any required headers
	headers = {
		"Content-Type": "application/json",
	}
	# Send a POST request to the API
	stac_api_response = requests.post(url, json=data, headers=headers)
	# Check if the request was successful
	if stac_api_response.status_code == 200:
		# Get the response data
		response_data = stac_api_response.json()
		print(response_data)
	else:
		print(f"Error: {stac_api_response.status_code} - {stac_api_response.text}")

	if len(response_data['features']) == 0:
		return None

	asset = response_data['features'].pop()

	try:
		bucket, key = asset['assets']['ndvi']["href"].replace("s3://", "").split("/", 1)
		s3 = boto3.client('s3')
		print(bucket, key)
		s3_get_response = s3.get_object(Bucket=bucket, Key=key)
		# Access the object's contents
		object_content = s3_get_response["Body"].read()
		with rasterio.open(BytesIO(object_content)) as src:
			# Access the image data and metadata
			raster_data = src.read()
			profile = src.profile
			return raster_data
	except s3.exceptions.NoSuchKey as e:
		print(f"Error: {e}")


def calculate_ndvi_percentage_difference(previous_ndvi_values, current_ndvi_values):
	# convert both to one dimensional array
	current_tif_array = current_ndvi_values.ravel()
	previous_tif_array = previous_ndvi_values.ravel()
	# Calculate the percentage difference between current and previous TOI and ignore NDVI that is either 0 or has no value
	prev_aoi_average = np.mean(previous_tif_array[(previous_tif_array != 0) & ~np.isnan(previous_tif_array)])
	curr_aoi_average = np.mean(current_tif_array[(current_tif_array != 0) & ~np.isnan(current_tif_array)])
	print("Previous AOI average : {}".format(prev_aoi_average))
	print("Current AOI average : {}".format(curr_aoi_average))
	percentage_diff = (prev_aoi_average - curr_aoi_average) / prev_aoi_average * 100
	print("Percentage difference: {}".format(percentage_diff))
	return percentage_diff


def calculate_statistic_for_histogram(stac_asset_band, bins=10):
	band_array = stac_asset_band.data.flatten()
	band_min = band_array.min()
	band_max = band_array.max()
	counts, bins = np.histogram(band_array, bins)
	# Set the raster:bands metadata for the ndvi band
	ndvi_raster_bands = [
		{
			# "spatial_resolution": 20,  # TODO: what is spatial resolution?
			"nodata": 0,
			"data_type": "uint8",
			"histogram": [
				{
					"count": len(band_array),
					"min": band_min,
					"max": band_max,
					"buckets": bins.tolist(),
					"bucket_count": counts.tolist(),
				}
			],
			"statistics": {
				"minimum": band_min,
				"maximum": band_max,
				"mean": band_array.mean(),
				"stddev": band_array.std(),
				# "valid_percent": 100  # TODO: How do we calculate valid_percentage?
			}
		}
	]
	return ndvi_raster_bands

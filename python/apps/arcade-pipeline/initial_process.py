import argparse
import json
import os
import boto3
from logger_utils import get_logger
from stac_catalog_processor import STACCatalogProcessor, EngineProcessRequest
from utils.tiff_image_processor import write_to_tif, create_tif_file_metadata, calculate_checksum

logger = get_logger(__name__)

checksum_algorithm = 'md5'


def publish_event(event):
	# Create an EventBridge client
	eventbridge = boto3.client('events')
	# Publish the event to EventBridge
	response = eventbridge.put_events(
		Entries=[
			event
		]
	)
	print(response)


def start_task(
	input_json_string: str,
	output_bucket: str,
	event_bus_name: str,
	aws_batch_job_id: str
):
	logger.info(f"Starting Stac Catalog Processor Job")
	try:
		data = json.loads(input_json_string)
		request = EngineProcessRequest.from_dict(data)

		publish_event({
			'EventBusName': event_bus_name,
			'Source': 'com.aws.arcade.engine',
			'DetailType': 'com.aws.arcade>results>started',
			'Detail': json.dumps({
				"groupId": request.group_id,
				"zoneId": request.zone_id,
				"regionId": request.region_id,
				"schedule": request.schedule_date_time,
				"jobId": aws_batch_job_id,
			}),
		})

		processor = STACCatalogProcessor(request)
		# Search from stac catalog
		processor.search_stac_items()
		# Load the bands from the satellite images
		stac_assets = processor.calculate_bands_from_stac_item()
		# Run cloud removal
		stac_assets = processor.calculate_cloud_removal_band(stac_assets)
		# Calculate ndvi raw
		stac_assets = processor.calculate_ndvi_raw_band(stac_assets)
		# Fill cloud gap
		stac_assets = processor.fill_cloud_gap(stac_assets)
		# Fill cloud gap
		stac_assets = processor.calculate_ndvi_change(stac_assets)

		output_metadata = {
			"bounding_box": processor.bounding_box.tolist(),
			"geometry": {
				'type': 'Polygon',
				'coordinates': request.coordinates
			},
			"properties": {},
			"links": [{"rel": "derived_from", "href": link.href, "type": link.media_type} for link in processor.stac_item.links if link.rel == 'self'].pop(),
			"assets": {}
		}

		temp_dir = "{}/{}".format(os.getcwd(), "output")
		band_file_paths = write_to_tif(temp_dir, stac_assets, 'images', ['red', 'green', 'blue', 'scl', 'nir08', 'ndvi', 'ndvi_raw', 'scl_cloud_removed', 'ndvi_change'])
		s3_prefix = 's3://{}/{}/{}/{}/{}'.format(output_bucket, request.group_id, request.region_id, request.zone_id, request.schedule_date_time)
		band_assets = create_tif_file_metadata(stac_assets, band_file_paths, "{}/{}".format(s3_prefix, "images"), checksum_algorithm)
		output_metadata['assets'] = {**output_metadata['assets'], **band_assets}

		yield_target = 20
		crop = 'wheat'  # Both crop and planted_at will be populated by lambda from state I pressume
		planted_at = '2024-04-01'

		area_acres = processor.calculate_area()
		# Set the area metadata
		output_metadata['properties'] = {**output_metadata['properties'], **{'area_size': area_acres, 'area_unit_of_measure': 'acres', 'crop_type': crop, 'crop_planted_at': planted_at}}
		# set the nitrogen recommendation
		nitrogen_recommendation = processor.calculate_nitrogen_recommendation(yield_target, area_acres)
		output_metadata['assets']['nitrogen_metadata'] = upload_nitroge_recommendation(nitrogen_recommendation, output_bucket, output_metadata, s3_prefix, temp_dir)

		# Output metadata.json
		with open("{}/metadata.json".format(temp_dir), "w") as file:
			# Write content to the file
			file.write(json.dumps(output_metadata))

		# Upload tif images
		upload_tif_images(output_bucket, '{}/{}/{}/{}'.format(request.group_id, request.region_id, request.zone_id, request.schedule_date_time), s3_prefix, temp_dir)

		publish_event({
			'EventBusName': event_bus_name,
			'Source': 'com.aws.arcade.engine',
			'DetailType': 'arcade>engine>pipeline>finish',
			'Detail': json.dumps({
				"executionId": "execution1234",
				"groupId": request.group_id,
				"zoneId": request.zone_id,
				"regionId": request.region_id,
				"schedule": request.schedule_date_time,
				"jobId": aws_batch_job_id,
				"engineOutPutLocation": f'{s3_prefix}/metadata.json'
			})}
		)

	except Exception as ex:
		logger.error("Processor failed.", exc_info=True)
		raise ex


def upload_nitroge_recommendation(nitrogen_recommendation, output_bucket, output_metadata, s3_prefix, temp_dir):
	nitrogen_file_path = "{}/nitrogen.json".format(temp_dir)
	with open(nitrogen_file_path, "w") as file:
		# Write content to the file
		file.write(json.dumps(nitrogen_recommendation))

	return {
		"href": "s3://{}/{}/nitrogen.json".format(output_bucket, s3_prefix),
		"type": "application/json",
		"file:checksum": calculate_checksum(nitrogen_file_path, checksum_algorithm),
		"file:size": os.path.getsize(nitrogen_file_path),
		"roles": [
			"metadata"
		]
	}


def upload_tif_images(output_bucket, s3_key_prefix, s3_prefix, temp_dir):
	# Create an S3 client
	s3 = boto3.client('s3')
	for root, dirs, files in os.walk(temp_dir):
		for file in files:
			# Construct the full file path
			file_path = os.path.join(root, file)
			# Construct the key (file path in S3)
			key = os.path.relpath(file_path, temp_dir)
			# Upload the file to S3
			s3.upload_file(file_path, output_bucket, "{}/{}".format(s3_key_prefix, key))
			print(f'Uploaded {file_path} to {s3_prefix}/{key}')


def main(parser):
	args = parser.parse_args()
	if args.verbose:
		# Testing arguments will pass in as input arguments
		logger.info("Development testing with input arguments")
		input_json_string = args.input_json_string
		output_bucket = args.output_bucket
		event_bus_name = args.event_bus_name
		batch_job_id = args.batch_job_id
	else:
		# Production arguments will pass in as env var
		logger.info("Production processor with env variable")
		input_json_string = os.getenv("INPUT_JSON_STRING")
		event_bus_name = os.getenv("EVENT_BUS_NAME")
		output_bucket = os.getenv("OUTPUT_BUCKET")
		batch_job_id = os.getenv("AWS_BATCH_JOB_ID")

	if not os.getenv("AWS_DEFAULT_REGION"):
		if os.getenv("AWS_REGION"):
			os.environ["AWS_DEFAULT_REGION"] = os.getenv("AWS_REGION")
			logger.info(
				"AWS_DEFAULT_REGION does not exist, overriding AWS_DEFAULT_REGION with AWS_REGION environment variable."
			)
		else:
			logger.warning(
				"The AWS Region is required to emit metrics on Cloudwatch, but it is not found in the environment variable."
			)

	try:
		logger.info(
			f"Starting docker processor with env variable:\n"
			f"input_json_string {input_json_string}\n"
			f"output_bucket {output_bucket}\n"
			f"event_bus_name {event_bus_name}\n"
			f"batch_job_id {batch_job_id}"
		)
		start_task(input_json_string, output_bucket, event_bus_name, batch_job_id)
		logger.info("Processor completed successfully.")
	except Exception as ex:
		logger.error("Processor failed.", exc_info=True)
		raise ex


if __name__ == "__main__":
	parser = argparse.ArgumentParser()
	parser.add_argument("-i", "--input-json-string", type=str)
	parser.add_argument("-o", "--output-bucket", type=str)
	parser.add_argument("-e", "--event-bus-name", type=str)
	parser.add_argument("-j", "--batch-job-id", default=0)
	parser.add_argument("-v", "--verbose", default=False)
	main(parser)

import argparse
import json
import os
from datetime import datetime
from typing import Any, Dict

import boto3

from logger_utils import get_logger
from processors.cloud_gap_fill_processor import CloudGapFillProcessor
from processors.cloud_removal_processor import CloudRemovalProcessor
from processors.metadata_utils import MetadataUtils
from processors.nitrogen_processor import NitrogenProcessor
from processors.tif_image_processor import TifImageProcessor
from processors.ndvi_change_processor import NdviChangeProcessor
from processors.ndvi_raw_processor import NdviRawProcessor
from stac_catalog_processor import STACCatalogProcessor, EngineProcessRequest

logger = get_logger(__name__)


def publish_event(event: Dict[str, Any]):
	# Create an EventBridge client
	eventbridge = boto3.client('events')
	# Publish the event to EventBridge
	response = eventbridge.put_events(
		Entries=[
			event
		]
	)
	print(response)


def get_input_json(bucket_name, file_key):
	s3 = boto3.client('s3')
	try:
		response = s3.get_object(Bucket=bucket_name, Key=file_key)
		json_data = response['Body'].read().decode('utf-8')
		json_content = json.loads(json_data)
		return json_content
	except s3.exceptions.NoSuchKey as e:
		print(f"Error: {e}")


def start_task(
	input_filename: str,
	input_prefix: str,
	job_array_index: str,
	output_bucket: str,
	event_bus_name: str,
	aws_batch_job_id: str
):
	logger.info(f"Starting Stac Catalog Processor Job")
	try:
		data = get_input_json(output_bucket, "{}/{}/{}".format(input_prefix, job_array_index, input_filename))
		request = EngineProcessRequest.from_dict(data)
		processor = STACCatalogProcessor(request)
		# Load the bands from the satellite images
		stac_assets, previous_ndvi_raster = processor.load_stac_datasets()

		temp_dir = "{}/{}".format(os.getcwd(), "output")

		cloud_removal_processor = CloudRemovalProcessor(previous_ndvi_raster)
		ndvi_raw_processor = NdviRawProcessor(previous_ndvi_raster)
		cloud_gap_fill_processor = CloudGapFillProcessor(previous_ndvi_raster)
		ndvi_change_processor = NdviChangeProcessor(previous_ndvi_raster)
		tif_image_processor = TifImageProcessor(temp_dir, previous_ndvi_raster)
		last_processor = cloud_removal_processor.set_next(ndvi_raw_processor).set_next(cloud_gap_fill_processor).set_next(ndvi_change_processor).set_next(tif_image_processor)

		# only run the nitrogen processor if we have the yield target
		if request.state is not None and request.state.attributes is not None and request.state.attributes.get('estimatedYield') is not None:
			estimated_yield = float(request.state.attributes['estimatedYield'])
			nitrogen_processor = NitrogenProcessor(temp_dir, estimated_yield, request.coordinates, previous_ndvi_raster)
			last_processor.set_next(nitrogen_processor)

		stac_assets = cloud_removal_processor.process(stac_assets)

		sentinel_link = [{"rel": "derived_from", "href": link.href, "type": link.media_type} for link in processor.stac_item.links if link.rel == 'self'].pop()

		MetadataUtils.generate_metadata(sentinel_link, processor.bounding_box.tolist(), stac_assets, temp_dir, output_bucket, request)

		MetadataUtils.upload_assets(output_bucket, request.output_prefix, temp_dir)

		publish_event({
			'EventBusName': event_bus_name,
			'Source': 'com.aws.arcade.executor',
			'DetailType': 'com.aws.arcade.executor>PolygonMetadata>created',
			'Detail': json.dumps({
				"groupId": request.group_id,
				"polygonId": request.polygon_id,
				"regionId": request.region_id,
				"resultId": request.result_id,
				"jobId": aws_batch_job_id,
				"scheduleDateTime": request.schedule_date_time,
				"engineOutputLocation": f'{request.output_prefix}/metadata.json',
				"createdAt": datetime.now().isoformat()
			})}
		)

	except Exception as ex:
		logger.error("Processor failed.", exc_info=True)
		raise ex


def main(parser):
	args = parser.parse_args()
	if args.verbose:
		# Testing arguments will pass in as input arguments
		logger.info("Development testing with input arguments")
		input_prefix = args.input_prefix
		input_filename = args.input_filename
		job_array_index = args.job_array_index
		output_bucket = args.output_bucket
		event_bus_name = args.event_bus_name
		batch_job_id = args.batch_job_id
	else:
		# Production arguments will pass in as env var
		logger.info("Production processor with env variable")
		input_prefix = os.getenv("INPUT_PREFIX")
		input_filename = os.getenv("INPUT_FILENAME")
		event_bus_name = os.getenv("EVENT_BUS_NAME")
		output_bucket = os.getenv("OUTPUT_BUCKET")
		batch_job_id = os.getenv("AWS_BATCH_JOB_ID")
		job_array_index = os.getenv("AWS_BATCH_JOB_ARRAY_INDEX", 0)

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
			f"input_filename {input_filename}\n"
			f"job_array_index {job_array_index}\n"
			f"input_prefix {input_prefix}\n"
			f"output_bucket {output_bucket}\n"
			f"event_bus_name {event_bus_name}\n"
			f"batch_job_id {batch_job_id}"
		)

		start_task(input_filename, input_prefix, job_array_index, output_bucket, event_bus_name, batch_job_id)
		logger.info("Processor completed successfully.")
	except Exception as ex:
		logger.error("Processor failed.", exc_info=True)
		raise ex


if __name__ == "__main__":
	parser = argparse.ArgumentParser()
	parser.add_argument("-i", "--input-prefix", type=str)
	parser.add_argument("-f", "--input-filename", type=str)
	parser.add_argument("-ai", "--job-array-index", type=str)
	parser.add_argument("-o", "--output-bucket", type=str)
	parser.add_argument("-e", "--event-bus-name", type=str)
	parser.add_argument("-j", "--batch-job-id", default=0)
	parser.add_argument("-v", "--verbose", default=False)
	main(parser)

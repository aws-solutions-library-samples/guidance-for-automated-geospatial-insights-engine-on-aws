# Use the official Python 3.11 image as the base image
#checkov:skip=CKV_DOCKER_2:This is a backend application
#checkov:skip=CKV_DOCKER_3:This is not required
FROM --platform=linux/amd64 python:3.11.9-alpine

# Set the working directory
WORKDIR /app

# Install system dependencies for GDAL
RUN apk add --no-cache gcc
RUN apk add --no-cache gdal
RUN apk add --no-cache gdal-dev
RUN apk add --no-cache build-base
RUN apk add --no-cache zlib
RUN apk add --no-cache proj
RUN apk add --no-cache geos-dev
RUN apk add --no-cache proj-util
RUN apk add --no-cache proj-dev
RUN apk add --no-cache linux-headers
RUN apk add --no-cache bash


RUN export CPLUS_INCLUDE_PATH=/usr/include/gdal
RUN export C_INCLUDE_PATH=/usr/include/gdal
RUN export LDFLAGS="-L/usr/local/opt/zlib/lib"
RUN export CPPFLAGS="-I/usr/local/opt/zlib/include"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Set the entrypoint
CMD ["python", "initial_process.py"]

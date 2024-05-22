ARG PYTHON_VERSION=3.11

FROM --platform=linux/amd64 public.ecr.aws/lambda/python:${PYTHON_VERSION}

WORKDIR /asset

COPY requirements.txt .
RUN pip install -r requirements.txt --no-cache-dir -t /asset --no-binary pydantic

# Copy function code
COPY api/ ./api/
COPY handler.py .

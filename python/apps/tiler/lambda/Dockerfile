ARG PYTHON_VERSION=3.11

FROM --platform=linux/amd64 public.ecr.aws/lambda/python:${PYTHON_VERSION}

# Copy dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir  --no-binary pydantic

# Copy function code
COPY api/ ${LAMBDA_TASK_ROOT}/api/
COPY handler.py ${LAMBDA_TASK_ROOT}

CMD ["handler.handler"]

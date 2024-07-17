ARG PYTHON_VERSION=3.11
#checkov:skip=CKV_DOCKER_2:This is a backend application
#checkov:skip=CKV_DOCKER_3:This is not required
FROM --platform=linux/amd64 public.ecr.aws/lambda/python:${PYTHON_VERSION}

# Copy dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir  --no-binary pydantic

# Copy function code
COPY api/ ${LAMBDA_TASK_ROOT}/api/
COPY handler.py ${LAMBDA_TASK_ROOT}

CMD ["handler.handler"]

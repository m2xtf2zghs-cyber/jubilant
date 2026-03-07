FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/workspace/apps/api

WORKDIR /workspace

COPY apps/api/requirements.txt /workspace/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /workspace/apps/api/requirements.txt

COPY apps/api /workspace/apps/api
COPY services/worker/start-worker.sh /workspace/services/worker/start-worker.sh
RUN chmod +x /workspace/services/worker/start-worker.sh

CMD ["/workspace/services/worker/start-worker.sh"]

#!/usr/bin/env sh
set -e

cd /workspace/apps/api
celery -A app.tasks.celery_app worker --loglevel=info

from __future__ import annotations

import io
from pathlib import Path

from app.core.config import settings

try:
    import boto3
    from botocore.exceptions import ClientError

    HAS_BOTO3 = True
except Exception:  # noqa: BLE001
    boto3 = None
    ClientError = Exception
    HAS_BOTO3 = False


class ObjectStorage:
    def __init__(self) -> None:
        self._local_root = Path("/tmp/creditatlas-object-storage") / settings.s3_bucket
        self._client = None
        if HAS_BOTO3 and boto3 is not None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
            )

    def ensure_bucket(self) -> None:
        if self._client is None:
            self._local_root.mkdir(parents=True, exist_ok=True)
            return

        try:
            self._client.head_bucket(Bucket=settings.s3_bucket)
        except ClientError:
            self._client.create_bucket(Bucket=settings.s3_bucket)

    def upload_bytes(self, key: str, content: bytes, content_type: str | None = None) -> None:
        if self._client is None:
            target = self._local_root / key
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            return

        if content_type:
            self._client.upload_fileobj(
                io.BytesIO(content),
                settings.s3_bucket,
                key,
                ExtraArgs={"ContentType": content_type},
            )
            return

        self._client.upload_fileobj(io.BytesIO(content), settings.s3_bucket, key)


storage = ObjectStorage()

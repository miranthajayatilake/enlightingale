import boto3
from .base import StorageService


class S3StorageService(StorageService):
    """AWS S3 storage. boto3 uses the EC2 instance role automatically — no keys needed in env."""

    def __init__(self, bucket: str, region: str) -> None:
        self._bucket = bucket
        self._client = boto3.client("s3", region_name=region)

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )
        return key

    async def load(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    async def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)

    def public_url(self, key: str) -> str:
        return f"https://{self._bucket}.s3.amazonaws.com/{key}"


def get_storage_service():
    from core.config import settings
    from storage.local import LocalStorageService

    if settings.STORAGE_BACKEND == "s3":
        return S3StorageService(settings.S3_BUCKET_NAME, settings.AWS_REGION)
    return LocalStorageService(settings.FILES_PATH)

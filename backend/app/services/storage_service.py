"""Durable object storage adapter for Cloudflare R2 / AWS S3 with local disk fallback."""

import logging
import mimetypes
import os
from pathlib import Path
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self._s3_client = None

    @property
    def is_s3_enabled(self) -> bool:
        backend = (settings.STORAGE_BACKEND or "local").lower()
        has_credentials = bool(
            settings.S3_ENDPOINT_URL
            and settings.S3_ACCESS_KEY_ID
            and settings.S3_SECRET_ACCESS_KEY
        )
        return backend == "s3" or has_credentials

    def _get_client(self):
        if self._s3_client is None:
            try:
                import boto3
                from botocore.config import Config
            except ImportError as exc:
                logger.error("boto3 is not installed; durable cloud storage unavailable: %s", exc)
                return None

            config = Config(
                retries={"max_attempts": 3, "mode": "standard"},
                signature_version="s3v4",
            )
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL or None,
                aws_access_key_id=settings.S3_ACCESS_KEY_ID or None,
                aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY or None,
                region_name=settings.S3_REGION_NAME or "auto",
                config=config,
            )
        return self._s3_client

    def derive_key(self, path: str | Path) -> str:
        """Derive an S3 object key from a filesystem path or relative key."""
        raw_str = str(path).replace("\\", "/").strip()
        
        # If already a relative key without a drive letter or leading root slash:
        if not (len(raw_str) > 1 and raw_str[1] == ":") and not raw_str.startswith("/"):
            clean = raw_str.lstrip("./")
            if clean:
                return clean

        p = Path(path).resolve()
        
        # Check against configured directories
        for prefix, dir_setting in [
            ("uploads", settings.UPLOAD_DIR),
            ("reports", settings.REPORT_DIR),
            ("screenshots", settings.SCREENSHOT_DIR),
            ("runtime", settings.REACT_TEMP_DIR),
        ]:
            try:
                resolved_dir = Path(dir_setting).resolve()
                rel = p.relative_to(resolved_dir)
                return f"{prefix}/{rel.as_posix()}"
            except (ValueError, TypeError):
                continue

        # Fallback to file name
        return f"assets/{p.name}"

    def upload_file(
        self,
        local_path: str | Path,
        key: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> str:
        """Upload a local file to S3/R2. Returns the S3 key."""
        local = Path(local_path)
        if not local.is_file():
            raise FileNotFoundError(f"Local file does not exist: {local_path}")

        derived_key = key or self.derive_key(local)
        if not self.is_s3_enabled:
            return derived_key

        client = self._get_client()
        if client is None:
            return derived_key

        if content_type is None:
            content_type, _ = mimetypes.guess_type(str(local))
            if not content_type:
                content_type = "application/octet-stream"

        extra_args = {"ContentType": content_type}
        try:
            client.upload_file(
                Filename=str(local),
                Bucket=settings.S3_BUCKET_NAME,
                Key=derived_key,
                ExtraArgs=extra_args,
            )
            logger.info("Uploaded %s to s3://%s/%s", local, settings.S3_BUCKET_NAME, derived_key)
        except Exception as exc:
            logger.error("Failed to upload %s to S3: %s", local, exc)
            raise

        return derived_key

    def sync_file(
        self,
        local_path: str | Path,
        key: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> Optional[str]:
        """Safely upload to S3 if configured. Does not fail callers if S3 sync encounters an error."""
        try:
            if not Path(local_path).is_file():
                return None
            return self.upload_file(local_path, key=key, content_type=content_type)
        except Exception as exc:
            logger.warning("Storage sync skipped/failed for %s: %s", local_path, exc)
            return None

    def download_file(self, key: str, destination_path: str | Path) -> Path:
        """Download an S3 object to local disk."""
        dest = Path(destination_path)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if not self.is_s3_enabled:
            raise FileNotFoundError(f"S3 not configured and local file missing: {key}")

        client = self._get_client()
        if client is None:
            raise RuntimeError("S3 client could not be initialized")

        try:
            client.download_file(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Filename=str(dest),
            )
            logger.info("Downloaded s3://%s/%s to %s", settings.S3_BUCKET_NAME, key, dest)
            return dest
        except Exception as exc:
            logger.error("Failed to download %s from S3: %s", key, exc)
            raise

    def ensure_local(self, path_or_key: str | Path) -> Path:
        """Return a local Path to the requested file, downloading from S3 if missing."""
        local = Path(path_or_key)
        if local.is_file():
            return local

        if not self.is_s3_enabled:
            raise FileNotFoundError(f"File not found on disk: {path_or_key}")

        key = self.derive_key(path_or_key)
        client = self._get_client()
        if client is None:
            raise FileNotFoundError(f"File not found and S3 unavailable: {path_or_key}")

        # Download to the expected local path
        try:
            local.parent.mkdir(parents=True, exist_ok=True)
            client.download_file(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Filename=str(local),
            )
            logger.info("Retrieved missing local file from S3: %s -> %s", key, local)
            return local
        except Exception as exc:
            logger.warning("Could not retrieve key %s from S3: %s", key, exc)
            raise FileNotFoundError(f"File not found on disk or cloud storage: {path_or_key}") from exc

    def file_exists(self, path_or_key: str | Path) -> bool:
        """Check if file exists either locally or in S3."""
        if Path(path_or_key).is_file():
            return True

        if not self.is_s3_enabled:
            return False

        client = self._get_client()
        if client is None:
            return False

        key = self.derive_key(path_or_key)
        try:
            client.head_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            return True
        except Exception:
            return False

    def delete_file(self, path_or_key: str | Path) -> None:
        """Delete file locally and from S3."""
        local = Path(path_or_key)
        if local.is_file():
            try:
                local.unlink()
            except OSError as exc:
                logger.warning("Could not delete local file %s: %s", local, exc)

        if self.is_s3_enabled:
            client = self._get_client()
            if client:
                key = self.derive_key(path_or_key)
                try:
                    client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
                    logger.info("Deleted s3://%s/%s", settings.S3_BUCKET_NAME, key)
                except Exception as exc:
                    logger.warning("Could not delete S3 object %s: %s", key, exc)

    def get_public_url(self, path_or_key: str | Path, expires_in: int = 3600) -> Optional[str]:
        """Get a public CDN URL or presigned URL for an object."""
        key = self.derive_key(path_or_key)
        if settings.S3_PUBLIC_URL_PREFIX:
            return f"{settings.S3_PUBLIC_URL_PREFIX.rstrip('/')}/{key.lstrip('/')}"

        if self.is_s3_enabled:
            client = self._get_client()
            if client:
                try:
                    return client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
                        ExpiresIn=expires_in,
                    )
                except Exception as exc:
                    logger.warning("Could not generate presigned URL for %s: %s", key, exc)
        return None


storage_service = StorageService()

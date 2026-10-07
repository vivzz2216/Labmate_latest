import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from app.config import settings
from app.services.storage_service import StorageService


def test_derive_key_categorizes_correctly():
    service = StorageService()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        upload_dir = root / "uploads"
        report_dir = root / "reports"
        screenshot_dir = root / "screenshots"
        
        upload_dir.mkdir()
        report_dir.mkdir()
        screenshot_dir.mkdir()
        
        with patch.object(settings, "UPLOAD_DIR", str(upload_dir)), \
             patch.object(settings, "REPORT_DIR", str(report_dir)), \
             patch.object(settings, "SCREENSHOT_DIR", str(screenshot_dir)):
            
            f1 = upload_dir / "test_manual.pdf"
            f1.touch()
            assert service.derive_key(f1) == "uploads/test_manual.pdf"
            
            f2 = report_dir / "workflows" / "42" / "result.docx"
            f2.parent.mkdir(parents=True)
            f2.touch()
            assert service.derive_key(f2) == "reports/workflows/42/result.docx"
            
            f3 = screenshot_dir / "job_1" / "shot.png"
            f3.parent.mkdir(parents=True)
            f3.touch()
            assert service.derive_key(f3) == "screenshots/job_1/shot.png"


def test_local_storage_fallback():
    service = StorageService()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        sample = Path(tmpdir) / "sample.txt"
        sample.write_text("hello local storage")
        
        with patch.object(settings, "STORAGE_BACKEND", "local"), \
             patch.object(settings, "S3_ENDPOINT_URL", ""), \
             patch.object(settings, "S3_ACCESS_KEY_ID", ""):
            
            assert not service.is_s3_enabled
            assert service.file_exists(sample)
            assert service.ensure_local(sample) == sample
            
            missing = Path(tmpdir) / "nonexistent.txt"
            assert not service.file_exists(missing)
            with pytest.raises(FileNotFoundError):
                service.ensure_local(missing)


def test_s3_upload_and_ensure_local():
    service = StorageService()
    mock_s3 = MagicMock()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        sample = Path(tmpdir) / "test.docx"
        sample.write_text("dummy docx content")
        
        with patch.object(settings, "STORAGE_BACKEND", "s3"), \
             patch.object(settings, "S3_ENDPOINT_URL", "https://mock.r2.cloudflarestorage.com"), \
             patch.object(settings, "S3_ACCESS_KEY_ID", "mock_key"), \
             patch.object(settings, "S3_SECRET_ACCESS_KEY", "mock_secret"), \
             patch.object(settings, "S3_BUCKET_NAME", "test-bucket"), \
             patch.object(service, "_get_client", return_value=mock_s3):
            
            assert service.is_s3_enabled
            
            # Test upload
            key = service.upload_file(sample, key="reports/test.docx")
            assert key == "reports/test.docx"
            mock_s3.upload_file.assert_called_once()
            
            # Test ensure_local when local file already exists
            assert service.ensure_local(sample) == sample
            
            # Test ensure_local when local file is missing but exists in S3
            missing = Path(tmpdir) / "cached_download.docx"
            result = service.ensure_local(missing)
            assert result == missing
            mock_s3.download_file.assert_called_once()


def test_s3_presigned_url_generation():
    service = StorageService()
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://mock-s3/presigned-url"
    
    with patch.object(settings, "STORAGE_BACKEND", "s3"), \
         patch.object(settings, "S3_ENDPOINT_URL", "https://mock.r2.cloudflarestorage.com"), \
         patch.object(settings, "S3_ACCESS_KEY_ID", "mock_key"), \
         patch.object(settings, "S3_SECRET_ACCESS_KEY", "mock_secret"), \
         patch.object(settings, "S3_PUBLIC_URL_PREFIX", ""), \
         patch.object(service, "_get_client", return_value=mock_s3):
        
        url = service.get_public_url("reports/sample.docx")
        assert url == "https://mock-s3/presigned-url"
        mock_s3.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": "reports/sample.docx"},
            ExpiresIn=3600,
        )


def test_public_cdn_prefix_url():
    service = StorageService()
    
    with patch.object(settings, "S3_PUBLIC_URL_PREFIX", "https://cdn.labmate.app"):
        url = service.get_public_url("reports/sample.docx")
        assert url == "https://cdn.labmate.app/reports/sample.docx"

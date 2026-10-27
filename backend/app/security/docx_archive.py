"""Inspect DOCX expansion before XML/document libraries allocate its contents."""
from zipfile import ZipFile, BadZipFile


def validate_docx_archive(path, max_bytes=200 * 1024**2, max_members=3000):
    try:
        with ZipFile(path) as archive:
            members = archive.infolist()
            names = [item.filename for item in members]
            if not {'[Content_Types].xml', 'word/document.xml'} <= set(names):
                raise ValueError('The file is not a valid Word document.')
            if len(members) > max_members or len(set(names)) != len(names):
                raise ValueError('The Word archive contains too many or duplicate entries.')
            if sum(item.file_size for item in members) > max_bytes or any(item.flag_bits & 1 for item in members):
                raise ValueError('The Word document is encrypted or too large after decompression.')
    except BadZipFile:
        raise ValueError('The file is not a valid Word document.') from None

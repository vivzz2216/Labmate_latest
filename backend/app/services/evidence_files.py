"""Validation and normalisation of screenshots a student attaches to an evidence part of a lab report.

The student's file is untrusted. Its type is decided by its content (never its name or declared type), it is
decoded and re-encoded as a plain PNG so no metadata or embedded payload is carried into the Word report, and
its size and pixel count are bounded before it is decoded.
"""
import io

MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 8000          # pixels, either side, before decoding
MAX_PIXELS = 40_000_000
OUTPUT_SIDE = 2400       # longest side of the stored image
IMAGE_MAGIC = {b"\x89PNG\r\n\x1a\n": "png", b"\xff\xd8\xff": "jpeg"}


def sniff(data):
    """'png', 'jpeg', 'pdf' or None, from the file's leading bytes."""
    for magic, kind in IMAGE_MAGIC.items():
        if data.startswith(magic):
            return kind
    if data[:1024].lstrip().startswith(b"%PDF-"):
        return "pdf"
    return None


def _checked_image(image):
    width, height = image.size
    if width < 1 or height < 1 or width > MAX_SIDE or height > MAX_SIDE or width * height > MAX_PIXELS:
        raise ValueError("The image is too large; use a screenshot under 8000 pixels on each side.")
    return image


def _pdf_first_page(data):
    import pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            if not pdf.pages:
                raise ValueError("The PDF has no pages.")
            return pdf.pages[0].to_image(resolution=130).original.convert("RGB")
    except ValueError:
        raise
    except Exception:
        raise ValueError("The PDF could not be read; export it again or upload a PNG or JPG instead.") from None


def normalize_evidence(data):
    """Return PNG bytes for an uploaded PNG, JPEG or (first page of a) PDF, or raise ValueError with a student-facing reason."""
    from PIL import Image, UnidentifiedImageError
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_BYTES:
        raise ValueError("The file is larger than 5 MB.")
    kind = sniff(data)
    if kind is None:
        raise ValueError("Upload a PNG, JPG or PDF file.")
    try:
        if kind == "pdf":
            image = _checked_image(_pdf_first_page(data))
        else:
            image = Image.open(io.BytesIO(data))
            _checked_image(image)
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValueError("The image could not be read; upload a valid PNG or JPG.") from None
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        flat = Image.new("RGB", image.size, (255, 255, 255))
        flat.paste(image, mask=image.getchannel("A"))
        image = flat
    else:
        image = image.convert("RGB")
    image.thumbnail((OUTPUT_SIDE, OUTPUT_SIDE))
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()

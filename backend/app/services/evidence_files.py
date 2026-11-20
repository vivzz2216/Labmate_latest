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


DATASET_SLOT = "powerbi_dataset"
CAPTURE_SLOT = "wireshark_pcap"
MAX_CAPTURE_BYTES = 8 * 1024 * 1024


def normalize_capture(data):
    """The student's packet capture bytes after checking they are a usable .pcap/.pcapng, or raise ValueError with a reason.

    The file is only ever decoded by LabMate's own parser (never executed or passed to another program); the checks keep out
    anything that is not an Ethernet capture the analyser can show.
    """
    from ..netlab.pcap import CaptureError, read_capture
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_CAPTURE_BYTES:
        raise ValueError("The capture is larger than 8 MB. Save a shorter capture or use a capture filter.")
    try:
        read_capture(data)
    except CaptureError as error:
        raise ValueError(str(error)) from None
    return bytes(data)
MAX_DATASET_BYTES = 5 * 1024 * 1024
MAX_DATASET_ROWS = 50_000
MAX_DATASET_COLUMNS = 60


def normalize_dataset(data):
    """UTF-8 CSV bytes for a student's dataset, or raise ValueError with a student-facing reason.

    The file is only ever parsed as text (by the studio page), never executed; the checks keep out binaries, spreadsheets
    saved with the wrong extension, and files too big for a browser to chart.
    """
    import csv
    import io
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_DATASET_BYTES:
        raise ValueError("The dataset is larger than 5 MB.")
    if b"\x00" in data[:8192] or data[:4] in (b"PK\x03\x04", b"\xd0\xcf\x11\xe0") or data[:5] == b"%PDF-":
        raise ValueError("Upload a CSV text file. Excel workbooks and PDFs are not supported; use File > Save As > CSV.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = data.decode("cp1252")
        except UnicodeDecodeError:
            raise ValueError("The file is not readable text. Save it as a UTF-8 CSV.") from None
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if text.lstrip()[:1] == "<":
        raise ValueError("That looks like a web page, not a CSV file.")
    try:
        rows = list(csv.reader(io.StringIO(text)))
    except csv.Error:
        raise ValueError("The CSV could not be parsed. Check for unbalanced quotes.") from None
    rows = [row for row in rows if any(cell.strip() for cell in row)]
    if len(rows) < 2:
        raise ValueError("The CSV needs a header row and at least one data row.")
    header = rows[0]
    if len(header) < 2:
        raise ValueError("The CSV needs at least two columns separated by commas.")
    if len(header) > MAX_DATASET_COLUMNS:
        raise ValueError("The CSV has more than %d columns." % MAX_DATASET_COLUMNS)
    if len(rows) - 1 > MAX_DATASET_ROWS:
        raise ValueError("The CSV has more than %d rows." % MAX_DATASET_ROWS)
    if not any(cell.strip() for cell in header):
        raise ValueError("The first row must be the column names.")
    return text.encode("utf-8")


def _checked_image(image):
    width, height = image.size
    if width < 1 or height < 1 or width > MAX_SIDE or height > MAX_SIDE or width * height > MAX_PIXELS:
        raise ValueError("The image is too large; use a screenshot under 8000 pixels on each side.")
    return image


def _pdf_first_page(data):
    import pdfplumber
    from .pdf_render import render_page_image
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            if not pdf.pages:
                raise ValueError("The PDF has no pages.")
            return render_page_image(pdf.pages[0]).convert("RGB")
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

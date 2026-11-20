"""Serialize native PDFium work across all PDF paths in this process."""
from threading import Lock

pdfium_lock = Lock()


def render_page_image(page, resolution=130):
    with pdfium_lock:
        # Detach the image from any buffer owned by the native renderer.
        return page.to_image(resolution=resolution).original.copy()

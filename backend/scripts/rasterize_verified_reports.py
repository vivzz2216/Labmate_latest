"""Rasterize Word-exported PDFs for page-by-page visual QA."""

import argparse
from pathlib import Path

import pypdfium2 as pdfium


def main(directory):
    for path in sorted(directory.glob("*.pdf")):
        pages = pdfium.PdfDocument(str(path))
        target = directory / path.stem
        target.mkdir(exist_ok=True)
        for index in range(len(pages)):
            rendered = pages[index].render(scale=1.5).to_pil()
            rendered.save(target / f"page-{index + 1}.png")
        print(f"Rasterized {path.name}: {len(pages)} pages", flush=True)
        pages.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    main(parser.parse_args().directory.resolve())

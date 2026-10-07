"""Make contact sheets for read-only visual QA of verified Word renders."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps
import pypdfium2 as pdfium


def main(render_root: Path) -> None:
    destination = render_root / "contact_sheets"
    destination.mkdir(exist_ok=True)
    for folder in sorted(path for path in render_root.iterdir() if path.is_dir() and path.name != destination.name):
        pages = sorted(folder.glob("page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))
        if not pages:
            continue
        pdf_path = render_root / f"{folder.name}.pdf"
        with pdfium.PdfDocument(str(pdf_path)) as document:
            pages = pages[:len(document)]  # Ignore stale PNGs from an earlier, longer revision.
        for offset in range(0, len(pages), 6):
            batch = pages[offset:offset + 6]
            sheet = Image.new("RGB", (1120, 2520), "#e5e7eb")
            draw = ImageDraw.Draw(sheet)
            for index, path in enumerate(batch):
                with Image.open(path) as source:
                    page = ImageOps.contain(source.convert("RGB"), (530, 775))
                x = 20 + (index % 2) * 550
                y = 20 + (index // 2) * 830
                draw.text((x + 3, y), f"{folder.name} | page {offset + index + 1}", fill="#111827")
                sheet.paste(page, (x + (530 - page.width) // 2, y + 25))
            output = destination / f"{folder.name}_{offset // 6 + 1}.png"
            sheet.save(output)
        print(f"{folder.name}: {len(pages)} rendered pages, {(len(pages) + 5) // 6} sheets")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("render_root", type=Path)
    main(parser.parse_args().render_root.resolve())

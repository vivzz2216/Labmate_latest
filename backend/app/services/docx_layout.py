"""Append inline screenshots without modifying the user's styles or section settings."""

import io
import os
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Length, Pt, RGBColor, Twips
import docx.oxml.simpletypes as _docx_simpletypes

# Robustly handle decimal twips stored in Word/WPS XML margins (e.g. w:left="1441.9200134277344")
_orig_twips_convert = getattr(_docx_simpletypes.ST_TwipsMeasure, "convert_from_xml", None)
if _orig_twips_convert:
    def _safe_twips_convert(cls, str_value: str) -> Length:
        if "i" in str_value or "m" in str_value or "p" in str_value:
            return _docx_simpletypes.ST_UniversalMeasure.convert_from_xml(str_value)
        return Twips(int(round(float(str_value))))

    _docx_simpletypes.ST_TwipsMeasure.convert_from_xml = classmethod(_safe_twips_convert)


def apply_student_metadata(document, student_name: str, roll_no: str = "", department: str = "", institution: str = "", title: str = ""):
    """Set genuine student and college properties in the Word document metadata."""
    try:
        props = document.core_properties
        props.author = student_name or "Student"
        props.last_modified_by = student_name or "Student"
        props.title = title or f"{department or 'Laboratory'} Report"
        props.subject = f"{department or 'Computer Science'} Lab Manual"
        props.category = "Academic Lab Manual"
        if roll_no or institution:
            props.comments = f"Submitted by {student_name} ({roll_no}) - {institution}".strip()
    except Exception:
        pass


def _add_table(document, table):
    """A small bordered table ({'headers': [...], 'rows': [[...]]}) with a shaded header row.

    Borders are written directly, because a manual's own Word template may not define the 'Table Grid' style.
    """
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    headers, rows = table["headers"], table["rows"]
    grid = document.add_table(rows=1 + len(rows), cols=len(headers))
    properties = grid._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement("w:" + edge)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:color"), "94A3B8")
        borders.append(element)
    properties.append(borders)
    for column, text in enumerate(headers):
        cell = grid.rows[0].cells[column]
        cell.text = ""
        run = cell.paragraphs[0].add_run(text)
        run.bold = True
        run.font.size = Pt(9)
        shade = OxmlElement("w:shd")
        shade.set(qn("w:val"), "clear")
        shade.set(qn("w:fill"), "E2E8F0")
        cell._tc.get_or_add_tcPr().append(shade)
    for row_index, row in enumerate(rows, 1):
        for column, text in enumerate(row):
            cell = grid.rows[row_index].cells[column]
            cell.text = ""
            cell.paragraphs[0].add_run(text).font.size = Pt(9)
    spacer = document.add_paragraph()
    spacer.paragraph_format.space_after = Pt(4)
    return grid


def embed_theory_block(document, question_text: str, answer_text: str, question_num: int = 1, table=None):
    """
    Format a theoretical concept or viva answer cleanly in the Word document.
    Enforces clean typography, subtle indentation, and preserves the strict rule
    that programming sections remain screenshots-only (zero raw code text).
    """
    # Question Paragraph
    p_q = document.add_paragraph()
    p_q.paragraph_format.keep_with_next = True
    p_q.paragraph_format.space_before = Pt(12)
    p_q.paragraph_format.space_after = Pt(4)

    run_num = p_q.add_run(f"Question {question_num}: ")
    run_num.bold = True
    run_num.font.size = Pt(11)
    run_num.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)  # Slate 900

    run_text = p_q.add_run(question_text.strip())
    run_text.font.size = Pt(11)
    run_text.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)  # Slate 800

    # Answer Paragraphs
    clean_answer = str(answer_text or "").strip()
    if clean_answer:
        p_ans_label = document.add_paragraph()
        p_ans_label.paragraph_format.keep_with_next = True
        p_ans_label.paragraph_format.space_before = Pt(3)
        p_ans_label.paragraph_format.space_after = Pt(2)
        p_ans_label.paragraph_format.left_indent = Inches(0.15)
        
        lbl = p_ans_label.add_run("Answer / Theory:")
        lbl.bold = True
        lbl.font.size = Pt(10)
        lbl.font.color.rgb = RGBColor(0x33, 0x41, 0x55)  # Slate 700

        for paragraph_line in clean_answer.split("\n"):
            line = paragraph_line.strip()
            if not line:
                continue
            p_ans = document.add_paragraph()
            p_ans.paragraph_format.left_indent = Inches(0.2)
            p_ans.paragraph_format.space_after = Pt(4)
            p_ans.paragraph_format.line_spacing = 1.15
            run_line = p_ans.add_run(line)
            run_line.font.size = Pt(10)
            run_line.font.color.rgb = RGBColor(0x33, 0x41, 0x55)  # Slate 700

    if table:
        _add_table(document, table)

    # Subtle space before next item
    p_spacer = document.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(0)
    p_spacer.paragraph_format.space_after = Pt(8)
    return p_q


def embed_conclusion(document, text: str):
    """The experiment's Conclusion, after every part, in the same typography as the answers."""
    heading = document.add_paragraph()
    heading.paragraph_format.keep_with_next = True
    heading.paragraph_format.space_before = Pt(14)
    heading.paragraph_format.space_after = Pt(4)
    run = heading.add_run("Conclusion")
    run.bold = True
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    for line in str(text or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.paragraph_format.line_spacing = 1.15
        body = paragraph.add_run(line)
        body.font.size = Pt(10.5)
        body.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    return heading


def strip_procedure_heading(text):
    """The block prints its own "Procedure:" label; drop the model's copy ("Procedure:" or "Procedure: Web Scraping using
    ParseHub" keeps only "Web Scraping using ParseHub") so the label is not printed twice."""
    import re
    lines = str(text or "").strip().split("\n")
    if lines and re.match(r"^\s*\**\s*procedure\b\s*:?\s*\**\s*", lines[0], re.I):
        rest = re.sub(r"^\s*\**\s*procedure\b\s*:?\s*\**\s*", "", lines[0], flags=re.I).strip()
        lines = ([rest] if rest else []) + lines[1:]
    return "\n".join(lines).strip()


def embed_evidence_block(document, title: str, procedure_text: str, number: int = 1,
                         image_paths=(), captions=(), missing=(), table=None):
    """A part done in an outside tool: the written procedure, then the student's own screenshots.

    LabMate never draws these images. A screenshot the student has not attached yet is shown as a plain
    placeholder naming it, so an incomplete report is visibly incomplete instead of looking finished.
    """
    heading = document.add_paragraph()
    heading.paragraph_format.keep_with_next = True
    heading.paragraph_format.space_before = Pt(12)
    heading.paragraph_format.space_after = Pt(4)
    label = heading.add_run(f"Part {number}: ")
    label.bold = True
    label.font.size = Pt(11)
    label.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    name = heading.add_run(str(title).strip())
    name.font.size = Pt(11)
    name.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

    text = strip_procedure_heading(procedure_text)
    if text:
        tag = document.add_paragraph()
        tag.paragraph_format.keep_with_next = True
        tag.paragraph_format.left_indent = Inches(0.15)
        run = tag.add_run("Procedure:")
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            paragraph = document.add_paragraph()
            paragraph.paragraph_format.left_indent = Inches(0.2)
            paragraph.paragraph_format.space_after = Pt(4)
            paragraph.paragraph_format.line_spacing = 1.15
            body = paragraph.add_run(line)
            body.font.size = Pt(10)
            body.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

    if table:
        _add_table(document, table)
    captions = list(captions)
    for index, path in enumerate(image_paths):
        embed_screenshot(document, path, caption=captions[index] if index < len(captions) else "Student-supplied screenshot")
    for slot_label in missing:
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.left_indent = Inches(0.2)
        note = paragraph.add_run(f"[Not attached: {slot_label}. Upload it and generate the report again.]")
        note.italic = True
        note.font.size = Pt(10)
        note.font.color.rgb = RGBColor(0xB4, 0x23, 0x18)
    spacer = document.add_paragraph()
    spacer.paragraph_format.space_after = Pt(8)
    return heading
from PIL import Image


def create_report_document(upload, landscape=False):
    """Start a report with the complete uploaded manual, then a separate results section."""
    file_type = str(getattr(upload, "file_type", "")).lower()
    file_path = str(getattr(upload, "file_path", "") or "")
    source_is_docx = file_type == "docx" and os.path.isfile(file_path)

    if source_is_docx:
        document = Document(file_path)
        report_section = document.add_section(WD_SECTION.NEW_PAGE)
    else:
        document = Document()
        source_section = document.sections[0]
        source_section.orientation = WD_ORIENT.PORTRAIT
        source_section.page_width = Inches(8.5)
        source_section.page_height = Inches(11)
        source_section.left_margin = source_section.right_margin = Inches(.55)
        source_section.top_margin = source_section.bottom_margin = Inches(.5)

        if file_type == "pdf" and os.path.isfile(file_path):
            import pdfplumber

            document.add_paragraph(f"Uploaded input: {getattr(upload, 'original_filename', '')}")
            with pdfplumber.open(file_path) as pdf:
                for index, page in enumerate(pdf.pages):
                    image = page.to_image(resolution=130).original
                    buffer = io.BytesIO()
                    image.save(buffer, format="PNG")
                    buffer.seek(0)
                    available_width = source_section.page_width - source_section.left_margin - source_section.right_margin
                    available_height = source_section.page_height - source_section.top_margin - source_section.bottom_margin - Inches(.35)
                    scale = min(float(available_width) / image.width, float(available_height) / image.height)
                    paragraph = document.add_paragraph()
                    paragraph.paragraph_format.page_break_before = index > 0
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    paragraph.add_run().add_picture(
                        buffer,
                        width=int(image.width * scale),
                        height=int(image.height * scale),
                    )
            report_section = document.add_section(WD_SECTION.NEW_PAGE)
        else:
            report_section = source_section

    if landscape:
        report_section.orientation = WD_ORIENT.LANDSCAPE
        report_section.page_width = Inches(11.7)
        report_section.page_height = Inches(8.3)
    else:
        report_section.orientation = WD_ORIENT.PORTRAIT
        report_section.page_width = Inches(8.5)
        report_section.page_height = Inches(11)
    report_section.left_margin = report_section.right_margin = Inches(.7 if landscape else .65)
    report_section.top_margin = report_section.bottom_margin = Inches(.5 if landscape else .6)
    return document, source_is_docx


def embed_screenshot(document, image_path, caption=None, reserved_height=0.8, max_width=None):
    with Image.open(image_path) as image:
        pixels_w, pixels_h = image.size
        dpi = image.info.get("dpi", (96, 96))
        dpi_x, dpi_y = (dpi if isinstance(dpi, tuple) else (dpi, dpi))
        if pixels_w < 1 or pixels_h < 1:
            raise ValueError("Screenshot dimensions are invalid.")
        section = document.sections[-1]
        page_width = max(Inches(1), section.page_width - section.left_margin - section.right_margin)
        page_height = max(Inches(1), section.page_height - section.top_margin - section.bottom_margin - Inches(reserved_height))
        natural_w = Inches(pixels_w / (dpi_x or 96))
        display_w = max(Inches(1), min(natural_w, page_width))
        if max_width is not None:
            display_w = min(display_w, Inches(max_width))
        max_slice_h = max(1, int(pixels_w * page_height / display_w))

        # If the screenshot is only slightly taller than page_height (within 25%),
        # scale display_w down so the entire window fits on a single page cleanly
        # rather than awkwardly slicing off a tiny fragment at the bottom.
        if max_slice_h < pixels_h <= int(max_slice_h * 1.25):
            scaled_w = int(pixels_w * page_height / pixels_h)
            if scaled_w >= min(Inches(4.5), int(display_w * .8)):
                display_w = scaled_w
                max_slice_h = pixels_h

        # Detect dark theme for brightness checks
        bg_sample = image.crop((10, min(60, pixels_h - 1), min(100, pixels_w - 1), min(80, pixels_h))).convert("L")
        bg_brightness = bg_sample.getextrema()[1]
        is_dark_theme = bg_brightness < 128

        if is_dark_theme:
            brightness_check = lambda sample: sample.getextrema()[1] <= 50
        else:
            brightness_check = lambda sample: sample.getextrema()[0] >= 245

        # Pre-calculate slice boundaries to know total slices
        slices = []
        top = 0
        while top < pixels_h:
            bottom = min(pixels_h, top + max_slice_h)
            if bottom < pixels_h:
                sample_left = min(60, pixels_w - 1)
                sample_right = max(sample_left + 1, pixels_w - 60)
                search_floor = max(top + max_slice_h - 200, top + 1)
                for candidate in range(min(bottom, pixels_h - 1), search_floor, -1):
                    sample = image.crop((sample_left, candidate, sample_right, candidate + 1)).convert("L")
                    if brightness_check(sample):
                        bottom = candidate
                        break
            if pixels_h - bottom < 160 and pixels_h - top <= max_slice_h:
                bottom = pixels_h
            slices.append((top, bottom))
            top = bottom

        total_slices = len(slices)
        first_shape = None

        for slice_idx, (s_top, s_bottom) in enumerate(slices):
            paragraph = document.add_paragraph()
            if slice_idx > 0:
                paragraph.paragraph_format.page_break_before = True
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            paragraph.paragraph_format.keep_together = True
            paragraph.paragraph_format.keep_with_next = bool(caption)
            # Uploaded documents can have an exact/large Normal line height.
            # Never inherit that spacing for an inline screenshot.
            paragraph.paragraph_format.space_before = Pt(0)
            paragraph.paragraph_format.space_after = Pt(2)
            paragraph.paragraph_format.line_spacing = 1.0

            if s_top == 0 and s_bottom == pixels_h:
                source = str(image_path)
            else:
                source = io.BytesIO()
                image.crop((0, s_top, pixels_w, s_bottom)).save(source, format="PNG")
                source.seek(0)

            slice_h = int(display_w * (s_bottom - s_top) / pixels_w)
            shape = paragraph.add_run().add_picture(source, width=int(display_w), height=slice_h)
            if first_shape is None:
                first_shape = shape

            if caption:
                if total_slices == 1:
                    slice_cap = caption
                elif slice_idx == 0:
                    slice_cap = f"{caption} (Part 1 of {total_slices})"
                else:
                    slice_cap = f"{caption} (Part {slice_idx + 1} of {total_slices} — continued)"

                cap_para = document.add_paragraph()
                cap_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap_para.paragraph_format.keep_together = True
                cap_para.paragraph_format.space_before = Pt(0)
                cap_para.paragraph_format.space_after = Pt(3)
                cap_para.paragraph_format.line_spacing = 1.0
                run = cap_para.add_run(slice_cap)
                run.font.size = Pt(9)
                run.italic = True

    return first_shape


def save_document_atomic(document, destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".partial.docx")
    try:
        document.save(temporary)
        with ZipFile(temporary) as package:
            if package.testzip() is not None:
                raise ValueError("The generated Word package failed validation.")
        Document(temporary)  # Verify that document relationships and XML can be opened.
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()

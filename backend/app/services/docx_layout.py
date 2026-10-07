"""Append inline screenshots without modifying the user's styles or section settings."""

import io
import os
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor


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


def embed_theory_block(document, question_text: str, answer_text: str, question_num: int = 1):
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

    # Subtle space before next item
    p_spacer = document.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(0)
    p_spacer.paragraph_format.space_after = Pt(8)
    return p_q
from PIL import Image


def embed_screenshot(document, image_path, caption=None):
    with Image.open(image_path) as image:
        pixels_w, pixels_h = image.size
        dpi = image.info.get("dpi", (96, 96))
        dpi_x, dpi_y = (dpi if isinstance(dpi, tuple) else (dpi, dpi))
        if pixels_w < 1 or pixels_h < 1:
            raise ValueError("Screenshot dimensions are invalid.")
        section = document.sections[-1]
        page_width = section.page_width - section.left_margin - section.right_margin
        page_height = section.page_height - section.top_margin - section.bottom_margin - Inches(.8)
        natural_w = Inches(pixels_w / (dpi_x or 96))
        display_w = min(natural_w, page_width)
        max_slice_h = max(1, int(pixels_w * page_height / display_w))

        # If the screenshot is only slightly taller than page_height (within 25%),
        # scale display_w down so the entire window fits on a single page cleanly
        # rather than awkwardly slicing off a tiny fragment at the bottom.
        if max_slice_h < pixels_h <= int(max_slice_h * 1.25):
            scaled_w = int(pixels_w * page_height / pixels_h)
            if scaled_w >= Inches(4.5):
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
                for candidate in range(bottom, search_floor, -1):
                    sample = image.crop((sample_left, candidate, sample_right, candidate + 1)).convert("L")
                    if brightness_check(sample):
                        bottom = candidate
                        break
            slices.append((top, bottom))
            top = bottom

        total_slices = len(slices)
        first_shape = None

        for slice_idx, (s_top, s_bottom) in enumerate(slices):
            if slice_idx > 0:
                document.add_page_break()

            paragraph = document.add_paragraph()
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            paragraph.paragraph_format.keep_together = True
            paragraph.paragraph_format.keep_with_next = bool(caption)

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

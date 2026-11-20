"""Place each experiment's screenshots inside an uploaded PDF manual, directly below that experiment's output section.

A Word upload can take screenshots inside its own paragraphs (docx_layout.find_question_anchor). A PDF can't be edited, so its
pages used to be embedded whole at the start of the report with every screenshot after them. When the student asks for
screenshots under each question/experiment/output, the PDF is now rendered page by page and each page is cut where an
experiment's sample-output section ends (or where the experiment ends, when it has none); the experiment's screenshots are
inserted at that cut, and the rest of the page follows. An experiment that cannot be found in the PDF is left to the
normal results section after the manual.
"""
import io
import re
import unicodedata

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches

RESOLUTION = 130
MIN_SEGMENT_POINTS = 8
NUMBERED_TITLE = re.compile(r"^\s*(experiment|practical|exercise|program|assignment|question|lab)\s*(?:no\.?\s*|number\s*)?[-:#]?\s*(\d{1,3})\b", re.I)
OUTPUT_HEAD = re.compile(r"^\s*(?:\d{1,2}\s*[.)]\s*)?(?:sample\s+|expected\s+|program\s+)?(?:input\s*(?:and|&|/)\s*)?output\b", re.I)
# Sections that follow an output block in lab manuals. Numbered lines inside a sample output ("1. Push 10") do not qualify.
AFTER_OUTPUT_HEAD = re.compile(
    r"^\s*(?:\d{1,2}\s*[.)]\s*)?(?:result|conclusion|viva|post[- ]?lab|questions?|observations?|output\s+references|references|"
    r"verification|analysis|discussion|inference|precautions|remarks|outcomes?|lab\s+outcomes?)\b", re.I)


def _norm(text):
    text = unicodedata.normalize("NFKC", str(text or "")).casefold()
    text = re.sub(r"[‐-―]", "-", text)
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def pdf_lines(pdf):
    """Every text line of an open pdfplumber document as (page index, top, bottom, text), in reading order."""
    lines = []
    for index, page in enumerate(pdf.pages):
        for line in page.extract_text_lines() or []:
            text = str(line.get("text") or "").strip()
            if text:
                lines.append((index, float(line["top"]), float(line["bottom"]), text))
    return lines


def _title(result):
    return next((line.strip() for line in str(result.get("question") or "").splitlines() if line.strip()), "")


def _find_start(lines, title, cursor):
    want = _norm(title)
    if not want:
        return None
    key = want[:40]
    numbered = NUMBERED_TITLE.match(title)
    for index in range(cursor, len(lines)):
        have = _norm(lines[index][3])
        if have and (have.startswith(key) or (len(have) >= 12 and key.startswith(have))):
            return index
    if numbered:  # the question text may have been reworded; the experiment number still identifies its heading
        kind, number = numbered.group(1).lower(), numbered.group(2)
        for index in range(cursor, len(lines)):
            match = NUMBERED_TITLE.match(lines[index][3])
            if match and match.group(1).lower() == kind and match.group(2) == number:
                return index
    return None


def locate_anchors(lines, results):
    """{result index: line index where its screenshots go (len(lines) = after the last page)} for the results found."""
    starts, cursor = {}, 0
    for index, result in enumerate(results):
        start = _find_start(lines, _title(result), cursor)
        if start is not None:
            starts[index] = start
            cursor = start + 1
    anchors = {}
    ordered = sorted(starts.items(), key=lambda item: item[1])
    for position, (index, start) in enumerate(ordered):
        end = ordered[position + 1][1] if position + 1 < len(ordered) else len(lines)
        # The experiment also ends at the manual's next heading of the same kind ("Experiment 3"), even when that experiment
        # is not being processed.
        heading = NUMBERED_TITLE.match(lines[start][3])
        if heading:
            end = next((k for k in range(start + 1, end) if (match := NUMBERED_TITLE.match(lines[k][3]))
                        and match.group(1).lower() == heading.group(1).lower() and match.group(2) != heading.group(2)), end)
        output = next((k for k in range(start + 1, end) if OUTPUT_HEAD.match(lines[k][3])), None)
        anchor = end
        if output is not None:
            anchor = next((k for k in range(output + 1, end)
                           if AFTER_OUTPUT_HEAD.match(lines[k][3]) and not OUTPUT_HEAD.match(lines[k][3])), end)
        anchors[index] = anchor
    return anchors


def render_pdf_with_inserts(document, pdf_path, anchors, lines, insert, section):
    """Embed the PDF page by page, cutting pages at the anchors and calling insert(result index) at each cut."""
    import pdfplumber

    cuts = {}  # page index -> [(y, [result indexes])]
    tail = []
    for result_index, line_index in sorted(anchors.items(), key=lambda item: (item[1], item[0])):
        if line_index >= len(lines):
            tail.append(result_index)
            continue
        page_index, top = lines[line_index][0], lines[line_index][1]
        page_cuts = cuts.setdefault(page_index, [])
        if page_cuts and abs(page_cuts[-1][0] - top) < 0.5:
            page_cuts[-1][1].append(result_index)
        else:
            page_cuts.append((max(0.0, top - 2.0), [result_index]))
    available_width = section.page_width - section.left_margin - section.right_margin
    available_height = section.page_height - section.top_margin - section.bottom_margin - Inches(.35)
    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            full = page.to_image(resolution=RESOLUTION).original
            scale = min(float(available_width) / full.width, float(available_height) / full.height)
            points_to_pixels = full.height / float(page.height)
            boundaries = [0.0] + [y for y, _ in cuts.get(page_index, [])] + [float(page.height)]
            first = True
            for segment in range(len(boundaries) - 1):
                top, bottom = boundaries[segment], boundaries[segment + 1]
                if bottom - top >= MIN_SEGMENT_POINTS:
                    image = full.crop((0, int(top * points_to_pixels), full.width, min(full.height, int(round(bottom * points_to_pixels)))))
                    buffer = io.BytesIO()
                    image.save(buffer, format="PNG")
                    buffer.seek(0)
                    paragraph = document.add_paragraph()
                    paragraph.paragraph_format.page_break_before = page_index > 0 and first
                    paragraph.paragraph_format.space_after = 0
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    paragraph.add_run().add_picture(buffer, width=int(image.width * scale), height=int(image.height * scale))
                    first = False
                if segment < len(cuts.get(page_index, [])):
                    for result_index in cuts[page_index][segment][1]:
                        insert(result_index)
    for result_index in tail:
        insert(result_index)

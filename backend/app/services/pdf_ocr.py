"""Bounded OCR for scanned lab pages. Preserve page order; never invent text."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import io
import json
import re
from collections import Counter


def _run_stage(command, **kwargs):
    try:
        return subprocess.run(command, **kwargs)
    except subprocess.TimeoutExpired as error:
        raise ValueError('Scanned PDF processing exceeded its time limit; split the manual into smaller files.') from error
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or b'').decode('utf-8', 'replace')[-800:]
        raise ValueError('Scanned PDF processing failed. Check the OCR engine and file access. '+detail) from error


def _render_without_poppler(filename, pages, root):
    """Render whole pages when PDFium is available; otherwise accept only full-page scans.

    Embedded images are not general page renders: reject mosaics, text overlays,
    rotated pages and ambiguous layouts rather than silently losing content.
    """
    from PIL import Image
    try:
        import pypdfium2 as pdfium
    except ImportError:
        pdfium = None
    if pdfium:
        with pdfium.PdfDocument(str(filename)) as document:
            for number in pages:
                if number > len(document): raise ValueError('OCR page is outside the PDF.')
                page = document[number - 1]
                bitmap = None
                try:
                    bitmap = page.render(scale=min(2000 / max(page.get_size()), 3))
                    bitmap.to_pil().convert('RGB').save(root / f'page-{number:03}.png')
                finally:
                    if bitmap: bitmap.close()
                    page.close()
        return
    import pdfplumber
    with pdfplumber.open(filename) as document:
        for number in pages:
            if number > len(document.pages): raise ValueError('OCR page is outside the PDF.')
            page = document.pages[number - 1]
            images = page.images
            if page.rotation or len(images) != 1 or page.chars:
                raise ValueError('This scanned PDF needs Poppler or PDFium to preserve its full page layout.')
            scan = images[0]
            coverage = (scan['x1'] - scan['x0']) * (scan['bottom'] - scan['top']) / (page.width * page.height)
            if coverage < .9:
                raise ValueError('Embedded scan does not cover the full PDF page; configure Poppler or PDFium.')
            try:
                with Image.open(io.BytesIO(scan['stream'].get_data())) as image:
                    image.thumbnail((2000, 2000))
                    image.convert('RGB').save(root / f'page-{number:03}.png')
            except (OSError, ValueError) as error:
                raise ValueError('Embedded PDF scan cannot be decoded; configure Poppler or PDFium.') from error


UNREADABLE_PDF = 'This PDF could not be opened. It may be damaged or password-protected; save it again or upload the Word file.'
NOT_LAB_MANUAL = 'This PDF does not appear to be a lab manual or exercise sheet. Upload a PDF containing the lab instructions or questions.'

class NotLabManualError(ValueError):
    """A readable PDF did not contain recognizable lab work."""


_LAB_HEADING = re.compile(
    r"^\s*(?:\d+[.)]\s*)?(?:(?:[\w /&-]+\s+)?lab(?:oratory)?\s+manual\b|"
    r"(?:pre[- ]?|post[- ]?)?lab(?:oratory)?\s+(?:exercise|assignment|questions?)\b|"
    r"(?:experiment|practical|exercise)\s*(?:no\.?\s*)?[-–—:#]?\s*\d+\b)", re.I | re.M)
_TASK_START = re.compile(
    r"^\s*(?:(?:q(?:uestion)?\s*)?\d+\s*[.):–-]\s*|[a-z][.)]\s*|(?:aim|task|objective)\s*:\s*)?"
    r"(?:to\s+)?(?:write|wap|implement|create|develop|design|build|execute|run|compile|"
    r"demonstrate|perform|simulate|configure|train|calculate|find|display|define|explain|"
    r"list|describe|compare|identify|count|plot|insert|select|use|solve|construct)\b", re.I | re.M)


def validate_lab_pdf(text):
    """Require evidence of an exercise sheet before sending PDF text to extraction."""
    lab_heading = _LAB_HEADING.search(text)
    paper = re.search(r'^\s*(?:abstract|executive summary)\b', text, re.I | re.M) and re.search(
        r'^\s*(?:\d+(?:\.\d+)*[.)]?\s+)?(?:references|bibliography|works cited)\b', text, re.I | re.M)
    teaching_heading = re.search(r'^\s*[^\n]{0,80}\blab(?:oratory)?\s+(?:manual|exercise|assignment|questions?)\b',
                                 text, re.I | re.M)
    if (paper and not teaching_heading) or (not lab_heading and not _TASK_START.search(text)):
        raise NotLabManualError(NOT_LAB_MANUAL)


def strip_running_page_text(pages, edge_candidates=None):
    """Strip recurring margin text and page labels without changing the page body."""
    lines_by_page = [page.splitlines() for page in pages]
    edges = []
    for index, lines in enumerate(lines_by_page):
        nonempty = [i for i, line in enumerate(lines) if line.strip()]
        margins = edge_candidates[index] if edge_candidates is not None else None
        if margins is None:  # OCR has text but no reliable coordinates.
            margins = ([lines[i] for i in nonempty[:1]], [lines[i] for i in nonempty[-1:]]) if len(nonempty) >= 3 else ([], [])
        page_edges = []
        for positions, margin in zip((nonempty[:3], nonempty[-3:]), margins):
            keys = {' '.join(line.split()).casefold() for line in margin}
            page_edges.append({i: ' '.join(lines[i].split()).casefold() for i in positions
                               if ' '.join(lines[i].split()).casefold() in keys})
        edges.append(page_edges)

    counts = [Counter(key for pair in edges for key in set(pair[side].values())) for side in (0, 1)]
    page_labels = [re.fullmatch(r'(?:page\s+)?(\d{1,3})(?:\s*(?:of|/)\s*\d{1,3})?', key)
                   for pair in edges for key in pair[1].values()]
    numbers = {int(match[1]) for match in page_labels if match}
    sequential_numbers = any(number + 1 in numbers for number in numbers)
    cleaned = []
    for page_index, (lines, (top, bottom)) in enumerate(zip(lines_by_page, edges)):
        remove = set()
        for side, margin in enumerate((top, bottom)):
            for i, key in margin.items():
                heading = _LAB_HEADING.match(lines[i])
                recurring_title = heading and re.search(r'\blab(?:oratory)?\s+manual\b', key)
                code_line = re.search(r'^[\s]*(?:#include\b|#!|>>>|\$\s|(?:return|import|from|public|class)\s)|[;{}]\s*$', lines[i])
                if code_line or _TASK_START.match(lines[i]) or (heading and (not recurring_title or page_index == 0)):
                    continue
                if re.fullmatch(r'page\s+\d+(?:\s*(?:of|/)\s*\d+)?', key) or (
                    side == 1 and sequential_numbers and re.fullmatch(r'\d{1,3}', key)
                ) or counts[side][key] >= max(2, (2 * len(pages) + 2) // 3):
                    remove.add(i)
        cleaned.append('\n'.join(line for i, line in enumerate(lines) if i not in remove))
    return cleaned


def pdf_text_pages(filename):
    """Shared, ordered text/OCR path for workflow and fallback parser.

    Only a page that carries an image is scanned text. A blank page, or a page whose only content is a short header,
    has nothing to recognise and is kept as it is rather than sent to OCR.
    """
    import pdfplumber
    try:
        with pdfplumber.open(filename) as document:
            if len(document.pages) > 100: raise ValueError('Please upload an assignment of 100 pages or fewer.')
            texts, has_image, margins = [], [], []
            for page in document.pages:
                texts.append(page.extract_text() or '')
                has_image.append(bool(page.images))
                if hasattr(page, 'crop') and texts[-1]:
                    x0, y0, x1, y1 = page.bbox
                    band = (y1 - y0) * 0.08
                    margins.append(tuple((page.crop(box).extract_text() or '').splitlines() for box in (
                        (x0, y0, x1, y0 + band), (x0, y1 - band, x1, y1))))
                else:
                    margins.append(None)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError(UNREADABLE_PDF) from error
    def body_length(index):
        if margins[index] is None:
            return len(texts[index].strip())
        margin_lines = {line.strip() for side in margins[index] for line in side}
        return len('\n'.join(line for line in texts[index].splitlines() if line.strip() not in margin_lines).strip())

    scanned = [i + 1 for i in range(len(texts)) if body_length(i) < 20 and has_image[i]]
    # A page that OCR reads as (almost) nothing is a diagram or an output screenshot when the rest of the manual is
    # readable; only a manual with no readable page at all is rejected.
    readable_elsewhere = any(len(text.strip()) >= 20 for text in texts)
    recognized = ocr_pdf_pages(filename, scanned, allow_empty=True)
    short = [number for number in scanned if len(recognized.get(number, '').strip()) < 20]
    # A wholly scanned manual whose pages mostly fail OCR is a bad scan; one blank or picture-only page is not.
    if short and not readable_elsewhere and len(short) * 2 > len(scanned):
        raise ValueError('Some scanned pages could not be read reliably; upload a clearer scan.')
    pages = [recognized.get(i + 1, text) for i, text in enumerate(texts)]
    pages = strip_running_page_text(pages, [None if i + 1 in recognized else m for i, m in enumerate(margins)])
    if not any(len(text.strip()) >= 20 for text in pages):
        raise ValueError('No readable text was found. Upload a text-based PDF, a clearer scan, or the Word file.')
    return pages


def _refine_unix_command_lines(root,script):
    """Re-read small command lines at higher resolution; never infer operands."""
    from PIL import Image,ImageOps
    refined=root/'command_lines';refined.mkdir()
    candidates=[]
    for metadata in sorted(root.glob('page-*.ocr.json')):
        rows=json.loads(metadata.read_text(encoding='utf-8-sig'))
        for row in rows:
            if not re.match(r'^\s*[a-z][.)]?\s+mkdir\s+',row['text'],re.I):continue
            if len(candidates)>=12:break
            image_path=metadata.with_name(metadata.name.replace('.ocr.json','.png'))
            with Image.open(image_path) as image:
                crop=image.crop((max(0,int(row['left'])-8),max(0,int(row['top'])-8),image.width,min(image.height,int(row['bottom'])+8)))
                crop=ImageOps.autocontrast(crop.convert('L'))
                scale=min(3,2400/crop.width)
                crop=crop.resize((int(crop.width*scale),int(crop.height*scale)))
                name='line-'+str(len(candidates))+'.png';crop.save(refined/name)
            candidates.append((metadata.with_name(metadata.name.replace('.ocr.json','.txt')),row['text'],refined/Path(name).with_suffix('.txt')))
    if not candidates:return
    _run_stage(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),'-Root',str(refined)],
               check=True,timeout=45,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    for text_file,old,crop_file in candidates:
        new=' '.join(crop_file.read_text(encoding='utf-8-sig').split())
        command=re.fullmatch(r'\s*([a-z])[.)]?\s+mkdir\s+([A-Za-z0-9_./ -]+)',new,re.I)
        if command and '/' in command.group(2) and len(new)>=len(old):
            text=text_file.read_text(encoding='utf-8-sig')
            text_file.write_text(text.replace(old,new,1),encoding='utf8')


def ocr_pdf_pages(filename,pages,allow_empty=False):
    if not pages:return {}
    if len(pages)>25:raise ValueError('Scanned manuals support up to 25 OCR pages; split this file.')
    if any(type(page) is not int or page < 1 for page in pages):raise ValueError('OCR pages must be positive page numbers.')
    pages = sorted(set(pages))
    with tempfile.TemporaryDirectory(prefix='labmate_ocr_') as folder:
        root=Path(folder)
        poppler = shutil.which('pdftoppm')
        # Prefer the in-process renderer when available. It preserves thin
        # scanned command operands more reliably than Poppler resampling.
        import importlib.util
        if importlib.util.find_spec('pypdfium2') is not None:poppler=None
        if not poppler:
            _render_without_poppler(filename, pages, root)
        for page in pages if poppler else []:
            _run_stage([poppler,'-f',str(page),'-l',str(page),'-singlefile','-scale-to','2000',
                            '-png',str(Path(filename).resolve()),str(root/f'page-{page:03}')],
                           check=True,timeout=20,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        tesseract=shutil.which('tesseract')
        if tesseract:
            for page in pages:
                _run_stage([tesseract,str(root/f'page-{page:03}.png'),str(root/f'page-{page:03}'),'-l','eng','--psm','3'],
                               check=True,timeout=20,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        elif os.name=='nt':
            script=Path(__file__).resolve().parents[1]/'scripts'/'windows_ocr.ps1'
            _run_stage(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(script),'-Root',str(root)],
                           check=True,timeout=min(120,len(pages)*15+10),stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            _refine_unix_command_lines(root,script)
        else:raise ValueError('Scanned PDF requires tesseract-ocr on the backend.')
        result={page:(root/f'page-{page:03}.txt').read_text(encoding='utf-8-sig').strip() for page in pages}
        # allow_empty: the caller has readable text on other pages, so a near-empty page is a diagram or screenshot.
        if any(len(text)<20 for text in result.values()) and not allow_empty:raise ValueError('Some scanned pages could not be read reliably; upload a clearer scan.')
        return result

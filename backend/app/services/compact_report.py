"""Short report layout using saved evidence, with no model calls."""
import re
import uuid
from pathlib import Path

from docx.shared import Inches,Pt,RGBColor

from ..config import settings
from ..security.validators import normalize_output_name
from .docx_layout import apply_student_metadata,create_report_document,embed_screenshot,save_document_atomic


# These are intentionally small record layouts, not generated prose. The image
# labels describe the evidence we actually have, including rendered editors.
LAB_STYLES = {
    'python': ('Cambria', 'Program', 'Output'),
    'java': ('Arial', 'Java program', 'Output'),
    'c': ('Calibri', 'C program', 'Output'),
    'cpp': ('Calibri', 'C++ program', 'Output'),
    'html': ('Calibri', 'Web page code', 'Browser output'),
    'react': ('Calibri', 'Project code', 'Browser output'),
    'node': ('Calibri', 'Server code', 'Output'),
    'colab': ('Arial', 'Notebook code', 'Notebook output'),
    'sql': ('Calibri', 'SQL script', 'Query result'),
}


def evidence_caption(language, caption):
    """Make known evidence captions readable without changing what was captured."""
    caption = ' '.join(str(caption or '').split())
    if not caption:
        return 'Execution evidence.'
    _, source, output = LAB_STYLES.get(language, ('Calibri', 'Code', 'Output'))
    patterns = (
        (r'^Rendered IDLE source preview\s*[—–-]\s*', f'{source} (IDLE-style preview) — '),
        (r'^Rendered Notepad source preview\s*[—–-]\s*', f'{source} (Notepad-style preview) — '),
        (r'^Rendered Code::Blocks source preview\s*[—–-]\s*', f'{source} (Code::Blocks-style preview) — '),
        (r'^VS Code-style source preview\s*[—–-]\s*', f'{source} (VS Code-style preview) — '),
        (r'^Colab code\s*[—–-]\s*', f'{source} (Colab-style preview) — '),
        (r'^Colab execution output\s*[—–-]\s*', f'{output} (Colab-style view) — '),
        (r'^MySQL Workbench SQL Script\s*[—–-]\s*', 'SQL script — '),
        (r'^MySQL Workbench Query\s+', 'Query '),
    )
    for pattern, replacement in patterns:
        if re.search(pattern, caption, flags=re.I):
            return re.sub(pattern, lambda _: replacement, caption, count=1, flags=re.I)
    if caption.lower() == 'captured process transcript':
        return f'{output} (recorded console)'
    if caption.lower() == 'actual browser capture':
        return 'Browser output (captured page)'
    return caption


def question_aim(question):
    """Include a supplied aim when it is present, without inventing one."""
    lines = str(question or '').splitlines()
    for line in lines[1:]:
        if re.match(r'^\s*aim\s*:', line, re.I):
            return line.strip()
    return ''


def short_text(text,limit=180):
    text=re.sub(r'[*`#]+','',str(text or ''))
    text=' '.join(text.split())
    return text if len(text)<=limit else text[:limit-1].rsplit(' ',1)[0]+'…'


def diagnostic_text(result):
    from .student_diagnostics import student_failure_message
    lines=['Diagnostic report — this experiment has not passed verification. ' + student_failure_message(result)]
    verification=result.get('verification') or {}
    kind=verification.get('kind') or ('browser' if result.get('language') in {'html','react'} else 'console')
    if verification.get('status')=='failed':
        label={'rstudio':'R / RStudio verification','notebook':'Python notebook verification','database':'MySQL verification',
            'gui':'Java UI interaction verification','http':'HTTP request verification'}.get(kind,'Browser interaction verification')
        lines.append(label+': FAILED')
        for test in verification.get('tests',[]):
            if test.get('status')!='failed':continue
            for index,step in enumerate((test.get('steps') or test.get('actions') or [])[:8],1):
                target=' '.join(str(step.get(key,'')) for key in ('locator_type','role','locator')).strip()
                lines.append(short_text(f"Step {index}: {step.get('action','')} {target}"))
            if test.get('expected_text'):lines.append('Expected visible text: '+short_text('; '.join(test['expected_text'])))
            if test.get('observed_text'):lines.append('Observed page text: '+short_text(test['observed_text']))
    if not result.get('screenshot_paths'):
        lines.append('Browser evidence unavailable.' if kind in {'browser','render','fullstack'} else 'Execution evidence unavailable.')
    return '\n'.join(lines)


def ensure_heading_style(document, name='Heading 2', size=13):
    """A manual exported by some tools has no heading styles; add a plain one rather than failing the whole report."""
    from docx.enum.style import WD_STYLE_TYPE
    if name not in [style.name for style in document.styles]:
        style = document.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        style.font.bold = True
        style.font.size = Pt(size)


def _filter_output_only_paths(paths, captions, result):
    if not paths:
        return paths, captions
    frames = (result.get('verification') or {}).get('evidence_frames') or []
    by_path = {f['path']: f for f in frames if f.get('path')}
    kept_idx = []
    for idx, path in enumerate(paths):
        kind = by_path.get(path, {}).get('kind', '')
        cap = str(captions[idx] if idx < len(captions) else '').lower()
        if kind == 'source_preview' or 'source preview' in cap or 'sql script' in cap or 'colab code' in cap:
            continue
        kept_idx.append(idx)
    if not kept_idx:
        return paths, captions
    return [paths[i] for i in kept_idx], [captions[i] if i < len(captions) else '' for i in kept_idx]


def build_compact_report(upload,workflow):
    from .docx_layout import embed_screenshots_after, find_question_anchor
    from .instruction_policy import parse_instruction_preferences
    from docx.enum.section import WD_SECTION

    prefs = parse_instruction_preferences(getattr(workflow, 'instructions', ''))
    can_paste_inline = (
        prefs.paste_under_question
        and str(getattr(upload, 'file_type', '')).lower() == 'docx'
        and Path(str(getattr(upload, 'file_path', '') or '')).is_file()
    )
    document,source_is_docx=create_report_document(
        upload,
        append_section=not can_paste_inline,
        include_pdf_pages=not prefs.no_extra_manual_pages,
    )
    ensure_heading_style(document)
    section=document.sections[-1]
    section.top_margin=section.bottom_margin=Inches(.6)
    languages={r.get('language') for r in workflow.results}
    if languages == {'sql'}:
        section.left_margin=section.right_margin=Inches(.55)
    font = prefs.font_name or (LAB_STYLES.get(next(iter(languages)), ('Calibri', '', ''))[0] if len(languages)==1 else 'Calibri')
    if not source_is_docx:
        for name in ('Normal','Title','Heading 1','Heading 2'):
            style=document.styles[name]
            style.font.name=font;style.font.color.rgb=RGBColor(0,0,0)
            for border in style._element.xpath('.//w:pBdr'):border.getparent().remove(border)
        document.styles['Normal'].font.size=Pt(prefs.font_size or 11)
        document.styles['Heading 2'].font.size=Pt((prefs.font_size + 2) if prefs.font_size else 13)
    anchor_cursor = 0
    appended_started = False
    for index,result in enumerate(workflow.results):
        question=next((line.strip() for line in result.get('question','').splitlines() if line.strip()),'')
        paths=result.get('screenshot_paths') or []
        captions=result.get('screenshot_captions') or []
        if result.get('language') == 'sql':
            frames=(result.get('verification') or {}).get('evidence_frames') or []
            by_path={f['path']:f for f in frames if f.get('path')}
            complete_results={f.get('result_statement_index') for f in frames if f.get('result_complete')}
            # Show the entire script from line 1 before query close-ups. The
            # capture receipt determines each page's actual SELECT result.
            ordered=sorted(enumerate(paths),key=lambda item: (
                by_path.get(item[1],{}).get('kind') != 'source_preview',
                (by_path.get(item[1],{}).get('source_ranges') or [(0,0)])[0][0]
                if by_path.get(item[1],{}).get('kind') == 'source_preview'
                else by_path.get(item[1],{}).get('statement_index', 0), item[0]))
            ordered=[(i,p) for i,p in ordered if not (
                by_path.get(p,{}).get('kind')=='database' and by_path.get(p,{}).get('statement_index') in complete_results)]
            # Full-script pages retain CREATE/DROP/INSERT source. Only actual
            # query frames supply table results; setup needs no extra output page.
            captions=[captions[i] if i<len(captions) else by_path.get(p,{}).get('caption','') for i,p in ordered]
            paths=[p for _,p in ordered]
        if prefs.output_only_screenshots:
            paths, captions = _filter_output_only_paths(paths, captions, result)

        resolved_captions = []
        for image_index, path in enumerate(paths):
            if not Path(path).is_file():
                raise ValueError('A required screenshot is missing: '+str(path))
            caption=evidence_caption(result.get('language'),captions[image_index] if image_index<len(captions) else '')
            if not re.search(r'\b(?:simulated|unverified|failed|diagnostic)\b', caption, re.I):
                # Interface details already appear in the image itself.
                caption = re.sub(r'\s*\([^)]*(?:style|preview)[^)]*\)', '', caption, flags=re.I)
                caption = re.sub(r'\s*\[[^\]]*(?:style|preview)[^\]]*\]', '', caption, flags=re.I)
            if result.get('language') == 'colab' and not re.search(r'\b(?:simulated|unverified|failed|diagnostic)\b', caption, re.I):
                # The notebook screenshots already contain their content; avoid
                # redundant per-slice labels and fit two readable frames per page.
                caption = None
            resolved_captions.append(caption)

        if can_paste_inline and not (result.get('is_theory') or result.get('language') == 'theory'):
            anchor = find_question_anchor(document, result.get('question', ''), start_index=anchor_cursor)
            if anchor:
                if not paths and result.get('status') == 'completed':
                    raise ValueError('Cannot export a completed exercise without its required screenshots.')
                if result.get('status') != 'completed':
                    if anchor[0] == 'paragraph':
                        diag_p = document.add_paragraph(diagnostic_text(result))
                        anchor[2]._p.addnext(diag_p._p)
                        anchor = ('paragraph', anchor[1], diag_p)
                    else:
                        anchor[2].add_paragraph(diagnostic_text(result))
                if paths:
                    embed_screenshots_after(
                        document,
                        anchor,
                        paths,
                        captions=[None if (prefs.output_only_screenshots and prefs.no_extra_questions) else c for c in resolved_captions],
                        max_width=6.25 if result.get('language') == 'colab' else None,
                    )
                if anchor[0] == 'paragraph' and anchor[1] is not None:
                    anchor_cursor = anchor[1] + 1
                continue

        if can_paste_inline and source_is_docx and not appended_started:
            document.add_section(WD_SECTION.NEW_PAGE)
        appended_started = True

        heading=document.add_paragraph(short_text(question or f"Program {result['id']}",240),style='Heading 2')
        heading.paragraph_format.keep_with_next=True
        heading.paragraph_format.page_break_before=index>0
        aim='' if prefs.no_extra_questions else question_aim(result.get('question'))
        if aim:
            aim_paragraph=document.add_paragraph(aim)
            aim_paragraph.paragraph_format.keep_with_next=True
        if result.get('status')!='completed':
            document.add_paragraph(diagnostic_text(result))
        if result.get('is_theory') or result.get('language') == 'theory':
            from .docx_layout import embed_theory_block
            embed_theory_block(document, question, result.get('answer') or result.get('theory_answer') or '', result.get('id', index + 1))
            continue
        if not paths and result.get('status')=='completed':
            raise ValueError('Cannot export a completed exercise without its required screenshots.')
        for image_index,path in enumerate(paths):
            caption = resolved_captions[image_index]
            # Leave room on the first page for the heading, aim and caption.
            reserve = min(3.0, 1.7 + max(0, len(aim) - 140) / 300) if image_index == 0 else .8
            if result.get('language') == 'sql':
                reserve = .7
            embed_screenshot(document,path,caption=caption,reserved_height=reserve,
                             max_width=6.25 if result.get('language') == 'colab' else None)

    viva_questions = list(getattr(workflow, 'viva_questions', None) or [])
    conclusion = str(getattr(workflow, 'conclusion', '') or '').strip()
    if str(getattr(upload, 'file_type', '')).lower() == 'pdf' and Path(str(getattr(upload, 'file_path', '') or '')).is_file():
        if (not viva_questions and not prefs.no_extra_questions) or (not conclusion and not prefs.no_conclusion):
            try:
                from .assignment_workflow import document_text
                from .manual_sections import extract_manual_conclusion, extract_viva_questions
                pdf_text = document_text(upload)
                if not viva_questions and not prefs.no_extra_questions:
                    viva_questions = extract_viva_questions(pdf_text)
                if not conclusion and not prefs.no_conclusion:
                    conclusion = extract_manual_conclusion(pdf_text)
            except Exception:
                pass
    if not (can_paste_inline and source_is_docx):
        if viva_questions and not prefs.no_extra_questions:
            from .docx_layout import embed_viva_section
            embed_viva_section(document, viva_questions)
        if conclusion and not prefs.no_conclusion:
            from .docx_layout import embed_conclusion
            embed_conclusion(document, conclusion)

    name=normalize_output_name(workflow.output_name or 'lab_report',max_length=80)+'.docx'
    directory=Path(settings.REPORT_DIR)/'workflows'/str(workflow.id)
    directory.mkdir(parents=True,exist_ok=True)
    path=directory/(uuid.uuid4().hex[:8]+'_'+name)
    apply_student_metadata(document,getattr(workflow,'student_name',''),title='Laboratory Results')
    save_document_atomic(document,str(path))
    from .storage_service import storage_service
    storage_service.sync_file(str(path))
    return str(path),name

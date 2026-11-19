"""Original manuals followed by evidence from real Ubuntu receipts."""
from pathlib import Path
import re
import uuid
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from ..config import settings
from ..security.validators import normalize_output_name
from .docx_layout import apply_student_metadata,save_document_atomic,create_report_document


def add_simulated_output_section(doc,result):
    verification=result.get('verification') or {}
    outputs=verification.get('simulated_outputs') or []
    observed=(verification.get('command_coverage') or {}).get('observed',[])
    # Logout can run safely in a disposable login subshell. Do not append a
    # contradictory "not executed" reference when that actual trace exists.
    outputs=[item for item in outputs if not (item.get('command')=='logout' and 'logout' in observed)]
    if not outputs:return
    doc.add_heading('Simulated expected output - not executed',2)
    notice=verification.get('simulated_output_notice') or (
        'These reference examples were not produced by the Ubuntu VM and are not execution evidence.'
    )
    doc.add_paragraph(notice)
    for item in outputs:
        doc.add_heading(item.get('command','Reference command'),3)
        paragraph=doc.add_paragraph()
        paragraph.paragraph_format.space_before=Pt(2)
        paragraph.paragraph_format.space_after=Pt(4)
        ppr=paragraph._p.get_or_add_pPr()
        shading=OxmlElement('w:shd');shading.set(qn('w:fill'),'F1F3F5');ppr.append(shading)
        run=paragraph.add_run(item.get('output',''))
        run.font.name='Consolas';run.font.size=Pt(9);run.font.color.rgb=RGBColor(40,45,52)
        note=doc.add_paragraph(item.get('note','Illustrative sample only; command not executed.'))
        note.paragraph_format.space_after=Pt(8)
        for run in note.runs:
            run.italic=True;run.font.size=Pt(9);run.font.color.rgb=RGBColor(110,85,20)


def add_postlab_notes(doc,result):
    if result.get('language')!='ubuntu':return
    from .unix_theory import unix_postlab_notes
    notes=unix_postlab_notes(result.get('question',''),profile=(result.get('ubuntu_command_plan') or {}).get('profile'))
    if not notes:return
    doc.add_heading('Post lab notes',2)
    for note in notes:
        paragraph=doc.add_paragraph(note)
        for run in paragraph.runs:run.font.size=Pt(10)


def build_ubuntu_report(upload,workflow):
    command_mode=bool(workflow.results) and all(r.get('language')=='theory' or
        (r.get('verification') or {}).get('command_mode') for r in workflow.results)
    doc,source_is_docx=create_report_document(upload,landscape=not command_mode)
    source_paragraph_count=len(doc.paragraphs)
    section=doc.sections[-1]
    section.orientation=WD_ORIENT.PORTRAIT if command_mode else WD_ORIENT.LANDSCAPE
    section.page_width=Inches(8.3 if command_mode else 11.7);section.page_height=Inches(11.7 if command_mode else 8.3)
    section.top_margin=section.bottom_margin=Inches(.5)
    section.left_margin=section.right_margin=Inches(.6)
    for name in ([] if source_is_docx else ['Normal','Title','Heading 1','Heading 2','Heading 3']):
        style=doc.styles[name];style.font.name='Calibri';style.font.color.rgb=RGBColor(0,0,0)
        for border in style._element.xpath('.//w:pBdr'):border.getparent().remove(border)
    if not source_is_docx:doc.styles['Normal'].font.size=Pt(11)
    title=doc.add_paragraph('Ubuntu Laboratory Results',style='Title')
    title.paragraph_format.space_after=Pt(3)
    for run in title.runs:run.font.size=Pt(16)
    complete=bool(workflow.results) and all(r.get('status')=='completed' and (
        r.get('language')=='theory' or (r.get('verification') or {}).get('status')=='passed') for r in workflow.results)
    if not complete:doc.add_paragraph('Diagnostic report. The following results distinguish completed commands from missing or unsupported evidence.')
    for index,result in enumerate(workflow.results,1):
        plan=result.get('ubuntu_command_plan') or {}
        heading=doc.add_heading('Experiment '+plan['profile']['experiment'] if complete and plan.get('profile') else
                               'Task '+str(index)+' '+result.get('status','unknown').upper(),1)
        heading.paragraph_format.space_before=Pt(4);heading.paragraph_format.space_after=Pt(3)
        for run in heading.runs:run.font.size=Pt(13)
        if index>1:heading.paragraph_format.page_break_before=True
        # The original manual is preserved at the start. A short task label
        # avoids repeating its full requirements in the results section.
        task_title=re.split(r'\bAim\s*:',result.get('question',''),maxsplit=1,flags=re.I)[0]
        task_title=re.split(r'(?m)^\s*\d+[.)]?\s*$',task_title,maxsplit=1)[0]
        if plan.get('title'):task_title=plan['title']
        doc.add_paragraph(' '.join(task_title.split())[:200])
        summary=result.get('verification_summary') or {}
        if not complete and summary.get('status'):doc.add_paragraph('Verification: '+summary['status'].replace('_',' '))
        verification=result.get('verification') or {}
        if verification.get('network_scope')=='private_loopback_fixtures':
            doc.add_paragraph('Networking scope: commands ran against private local DNS and WHOIS teaching services and actual loopback traffic. Internet routing and a physical Ethernet interface were not tested.')
        if verification.get('administrative_scope'):
            doc.add_paragraph('Administration scope: fdisk modified a disposable disk-image file; mount and umount used a private temporary filesystem. User and group changes applied only to the isolated practice account database.')
        for key,label in [('execution_status','Execution'),('capture_status','Native screenshots'),('requirements_status','Requirements')]:
            if not complete and verification.get(key):doc.add_paragraph(label+': '+verification[key].replace('_',' '))
        if result.get('is_theory') or result.get('language')=='theory':
            doc.add_paragraph('Theory answer only. No command execution is claimed.')
            doc.add_paragraph(result.get('answer',''))
        elif result.get('error'):
            from .student_diagnostics import student_failure_message
            doc.add_paragraph(student_failure_message(result))
            for limitation in (result.get('verification') or {}).get('limitations',[]):
                doc.add_paragraph(limitation)
        else:doc.add_paragraph('Executed in an isolated Ubuntu lab. The images show '+('commands' if verification.get('command_mode') else 'the source')+' and actual recorded output.')
        add_simulated_output_section(doc,result)
        if not complete:add_postlab_notes(doc,result)
        frames=(result.get('verification') or {}).get('evidence_frames') or []
        from .unix_theory import unix_postlab_notes
        long_notes=complete and len(unix_postlab_notes(result.get('question',''),profile=plan.get('profile')))>=4
        for frame_index,frame in enumerate(frames):
            if not Path(frame.get('path','')).is_file():raise ValueError('A required native Ubuntu frame is missing.')
            label={'editor':'Text file','files':'Files and folders'}.get(frame.get('component'),'Command output')
            if not command_mode:
                h=doc.add_heading('Source code' if frame['kind']=='source_preview' else label,2)
                h.paragraph_format.page_break_before=frame_index>0
            p=doc.add_paragraph(frame.get('caption','Native Ubuntu evidence'));p.paragraph_format.keep_with_next=True
            if command_mode:p.paragraph_format.page_break_before=frame_index>0 and frame_index%2==0
            for run in p.runs:run.font.size=Pt(9)
            width=6.2 if command_mode and frame.get('component')=='editor' else 7.0
            if command_mode and long_notes and frame_index>=len(frames)-2:width=min(width,6.3)
            doc.add_picture(frame['path'],width=Inches(width))
            p=doc.paragraphs[-1];p.paragraph_format.line_spacing=1.0
            p.paragraph_format.space_before=p.paragraph_format.space_after=Pt(0)
        if complete:add_postlab_notes(doc,result)
        if complete:
            from .unix_theory import unix_conclusion
            conclusion=unix_conclusion(result)
            if conclusion:
                doc.add_heading('Conclusion',2)
                for line_index,line in enumerate(conclusion):
                    paragraph=doc.add_paragraph(line)
                    paragraph.paragraph_format.keep_with_next=line_index<len(conclusion)-1
    # Imported manuals can give Normal large spacing or keep-with-next.
    # Format only appended paragraphs so a short introduction and the first
    # capture fit together, without modifying the student's original pages.
    for paragraph in doc.paragraphs[source_paragraph_count:]:
        paragraph.paragraph_format.line_spacing=1.0
        paragraph.paragraph_format.space_before=Pt(4 if paragraph.style.name.startswith('Heading') else 0)
        paragraph.paragraph_format.space_after=Pt(3)
        if paragraph.style.name=='Normal' and paragraph.paragraph_format.keep_with_next is None:
            paragraph.paragraph_format.keep_with_next=False
    name=normalize_output_name(workflow.output_name or Path(upload.original_filename).stem,max_length=80)+'.docx'
    directory=Path(settings.REPORT_DIR)/'workflows'/str(workflow.id);directory.mkdir(parents=True,exist_ok=True)
    path=directory/(uuid.uuid4().hex[:8]+'_'+name)
    apply_student_metadata(doc,getattr(workflow,'student_name',''),title='Ubuntu Laboratory Results')
    save_document_atomic(doc,str(path))
    from .storage_service import storage_service
    storage_service.sync_file(str(path))
    return str(path),name

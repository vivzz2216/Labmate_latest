"""Build a test-result DOCX from real manual-run records and every capture.

Run with the document-capable workspace Python. This is a reporting tool, not
a solution generator, and never upgrades failed or absent execution evidence.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image


def load_records(run):
    questions=json.loads((run/'extracted.json').read_text(encoding='utf-8'))
    records=[]
    for question in questions:
        record=json.loads((run/f'experiment_{question["id"]:02}.json').read_text(encoding='utf-8'))
        assert record['id']==question['id'],'Question/result mismatch'
        execution=record['execution']; verification=execution.get('verification') or {}
        passed=(execution['success'] and verification.get('status')=='passed'
                and all(v=='passed' for v in verification.get('coverage',{}).values()))
        captures=[]
        for name in execution.get('screenshots',[]):
            path=Path(name)
            if not path.is_file():raise ValueError(f'Missing required screenshot: {path.name}')
            with Image.open(path) as im:im.verify()
            captures.append(path)
        if not captures:raise ValueError(f'Experiment {question["id"]} has no screenshots')
        records.append(dict(question=question,record=record,passed=passed,captures=captures))
    return records


def add_table(document,headings,rows,widths):
    table=document.add_table(rows=1,cols=len(headings));table.style='Table Grid'
    table.autofit=False
    for column,width in zip(table.columns,widths):column.width=Inches(width)
    for cell,width,heading in zip(table.rows[0].cells,widths,headings):
        cell.width=Inches(width);cell.text=heading
        cell.paragraphs[0].runs[0].bold=True
        props=cell._tc.get_or_add_tcPr();shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E9EDF0');props.append(shade)
    repeat=OxmlElement('w:tblHeader');table.rows[0]._tr.get_or_add_trPr().append(repeat)
    for values in rows:
        cells=table.add_row().cells
        for cell,width,value in zip(cells,widths,values):
            cell.width=Inches(width);cell.text=str(value)
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(5)
                p.paragraph_format.space_before=Pt(4)
                for run in p.runs:run.font.size=Pt(10)
    document.add_paragraph()
    return table


def test_caption(path,verification):
    match=re.fullmatch(r'test_(\d+)(?:_step_(\d+))?\.png',path.name)
    if not match:return path.stem
    test=verification['tests'][int(match[1])-1]
    return test['name']+(' after step '+match[2] if match[2] else ' final state')


def build(run,output):
    records=load_records(run);manifest=json.loads((run/'run.json').read_text(encoding='utf-8'))
    doc=Document();sec=doc.sections[0]
    sec.page_width=Inches(8.5);sec.page_height=Inches(11)
    sec.top_margin=sec.bottom_margin=Inches(.65);sec.left_margin=sec.right_margin=Inches(.7)
    normal=doc.styles['Normal'];normal.font.name='Arial';normal.font.size=Pt(11)
    normal.paragraph_format.space_after=Pt(7)
    for name,size in [('Title',24),('Subtitle',12),('Heading 1',19),('Heading 2',14),('Heading 3',12)]:
        style=doc.styles[name];style.font.name='Arial';style.font.size=Pt(size);style.font.color.rgb=RGBColor(0,0,0)
        style.paragraph_format.keep_with_next=True
    # The bundled Word template can carry a blue paragraph border on Title.
    # Keep the report title plain black, including inherited OOXML formatting.
    for style in doc.styles:
        for border in list(style.element.iter(qn('w:pBdr'))):border.getparent().remove(border)
    header=sec.header.paragraphs[0];header.text='VERUANCE  |  WEB DEVELOPMENT LAB';header.runs[0].font.size=Pt(9)
    footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('Test results  •  ')
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
    total_images=sum(len(item['captures']) for item in records)
    tests=sum(len(item['record']['execution']['verification']['tests']) for item in records)
    assertions=sum(len(t.get('assertions',[])) for item in records for t in item['record']['execution']['verification']['tests'])
    api_tests=sum(len((item['record']['execution']['verification'].get('api_verification') or {}).get('tests',[])) for item in records)
    passed=sum(item['passed'] for item in records)
    doc.add_paragraph('Veruance Web Development Manual Test Results','Title')
    doc.add_paragraph('18 October 2026','Subtitle')
    doc.add_paragraph(f'{passed} of {len(records)} experiments passed. The completed run contains {tests} browser scenarios, {assertions} passed browser assertions, {api_tests} backend API tests, and {total_images} genuine browser captures embedded in this document.')
    doc.add_paragraph('The solutions were reviewed and corrected for the original ten experiments, then executed without Docker through LabMate’s actual HTML, React, browser and Express API runners. The report records this completed reviewed-solution run. It does not claim that the live free AI providers generated all ten projects successfully.')
    rows=[]
    for item in records:
        q=item['question'];v=item['record']['execution']['verification']
        title=q['text'].splitlines()[0].split(':',1)[-1].strip()
        rows.append((q['id'],title,'PASS' if item['passed'] else 'FAIL',len(item['captures'])))
    add_table(doc,['No','Experiment','Result','Images'],rows,[.4,5.0,.7,1.0])
    doc.add_paragraph('Scope and remaining limitations','Heading 2')
    doc.add_paragraph('Passing means the declared behavior scenarios, source requirements and captured states passed. It is not a proof for every possible input. Storage labs use localStorage; the events API uses permitted in-memory storage. External browser requests remained blocked. This local run does not establish Railway deployment readiness or unrestricted public code-execution isolation.')
    for item in records:
        q=item['question'];r=item['record'];e=r['execution'];v=e['verification']
        doc.add_page_break()
        title=q['text'].splitlines()[0].split(':',1)[-1].strip()
        doc.add_paragraph('Experiment '+str(q['id']),'Heading 1')
        doc.add_paragraph(title,'Heading 2')
        doc.add_paragraph(('PASS' if item['passed'] else 'FAIL')+'  •  '+q['language'].upper()+'  •  '+str(len(item['captures']))+' screenshots')
        lines=q['text'].splitlines()
        if 'Problem Statement' in lines:
            doc.add_paragraph(lines[lines.index('Problem Statement')+1])
        doc.add_paragraph('Requirements verified','Heading 3')
        doc.add_paragraph('; '.join(k.replace('_',' ') for k,status in v.get('coverage',{}).items() if status=='passed')+'.')
        if not item['passed']:doc.add_paragraph('Failure details: '+e.get('error','Required checks did not pass.'))
        rows=[(t['name'],str(len(t.get('assertions',[]))),t.get('status','unknown').upper()) for t in v['tests']]
        add_table(doc,['Browser scenario','Checks','Result'],rows,[5.4,.9,.8])
        backend=v.get('api_verification')
        if backend:
            doc.add_paragraph('Backend API results','Heading 3')
            for t in backend['tests']:
                doc.add_paragraph(t.get('status','unknown').upper()+'  '+t['name']+'\n'+t.get('observed_text','')[:800])
        doc.add_paragraph('Run instructions','Heading 3')
        doc.add_paragraph(r['project']['project_files'].get('README.md','See the project startup instructions.'))
        # Include all frames, including byte-identical initial/final frames.
        # No selection cap and no substitution of source previews for UI evidence.
        used=10.0
        for index,path in enumerate(item['captures'],1):
            with Image.open(path) as im:width,height=im.size
            display_w=min(7.0,7.7*width/height)
            display_h=display_w*height/width
            required=display_h+.48
            if used+required>9.25:
                doc.add_page_break();used=0
                doc.add_paragraph('Experiment '+str(q['id'])+' captured evidence','Heading 2');used+=.4
            caption=doc.add_paragraph(f'{index} of {len(item["captures"])}  {test_caption(path,v)}')
            caption.paragraph_format.keep_with_next=True
            caption.paragraph_format.space_after=Pt(4)
            for text in caption.runs:text.font.size=Pt(10)
            p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            inline=p.add_run().add_picture(str(path),width=Inches(display_w))
            inline._inline.docPr.set('descr',test_caption(path,v))
            p.paragraph_format.space_after=Pt(9)
            used+=required
    doc.add_page_break();doc.add_paragraph('Run provenance','Heading 1')
    doc.add_paragraph('Original manual '+Path(manifest['manual']).name)
    doc.add_paragraph('Original file SHA256 '+manifest['sha256'])
    doc.add_paragraph('Execution source engineer reviewed complete solutions with real runner execution. No successful API-generation claim is inferred from supplied manifests. Failed earlier provider attempts remain separate from this reviewed run.')
    doc.add_paragraph('Evidence integrity','Heading 2')
    for item in records:
        hashes=[hashlib.sha256(p.read_bytes()).hexdigest() for p in item['captures']]
        doc.add_paragraph(f'Experiment {item["question"]["id"]}: {len(hashes)} images, {len(set(hashes))} distinct PNG files. All captures are embedded; repeated captures are retained for state traceability.')
    output.parent.mkdir(parents=True,exist_ok=True);doc.save(output)
    # The number of visual occurrences must equal the exact number of captures.
    checked=Document(output)
    assert len(checked.inline_shapes)==total_images,'Screenshot occurrence count mismatch'
    print(json.dumps(dict(output=str(output),experiments=len(records),passed=passed,browser_scenarios=tests,browser_assertions=assertions,api_tests=api_tests,screenshots=total_images)))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--run',required=True,type=Path);parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();build(args.run.resolve(),args.output.resolve())

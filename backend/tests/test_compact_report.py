from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from docx import Document
from PIL import Image
import pytest

from app.config import settings
from app.services import assignment_workflow as flow
from app.services.compact_report import evidence_caption


def fixture_report(tmp_path,monkeypatch):
    monkeypatch.setattr(settings,'REPORT_DIR',str(tmp_path/'reports'))
    source=tmp_path/'manual.docx'
    doc=Document();doc.add_paragraph('Original manual cover and long instructions');doc.save(source)
    image=tmp_path/'evidence.png';Image.new('RGB',(600,300),'navy').save(image)
    upload=SimpleNamespace(file_path=str(source),file_type='docx',original_filename=source.name)
    # Report formatting must not send an AI request or reread the manual.
    monkeypatch.setattr(flow,'document_text',Mock(side_effect=AssertionError('Do not copy the original manual')))
    return source,image,upload


def test_code_reports_have_only_question_images_and_short_captions(tmp_path,monkeypatch):
    source,image,upload=fixture_report(tmp_path,monkeypatch)
    before=source.read_bytes()
    results=[]
    for number,language in enumerate(('python','java','html','colab','sql','cpp','c','react','node'),1):
        results.append(dict(id=number,language=language,status='completed',
            question=f'Experiment {number} {language} exercise\nLong detailed requirements',
            answer='A long explanation that must not appear.',code='RAW_SOURCE_MUST_NOT_APPEAR',
            project_files={'README.md':'Setup instructions must not appear.'},
            screenshot_paths=[str(image)],screenshot_captions=['Captured source and output.']))
    path,_=flow.build_word_report(upload,SimpleNamespace(id=1,mode='code_only',output_name='compact',results=results))
    doc=Document(path)
    assert len(doc.inline_shapes)==len(results)
    assert not doc.tables
    texts=[p.text for p in doc.paragraphs if p.text]
    assert texts==['Original manual cover and long instructions']+[text for r in results for text in ((r['question'].splitlines()[0],) if r['language']=='colab' else (r['question'].splitlines()[0],'Captured source and output.'))]
    assert source.read_bytes()==before
    for caption in [p for p in doc.paragraphs if p.text=='Captured source and output.']:
        assert caption._p.getprevious().xpath('.//w:drawing'),'Caption must follow its image'


def test_sql_default_uses_the_same_compact_structure(tmp_path,monkeypatch):
    _,image,upload=fixture_report(tmp_path,monkeypatch)
    result=dict(id=1,language='sql',status='completed',question='Experiment 1 Joins',
        answer='Do not add a conclusion or query summary table.',screenshot_paths=[str(image)],screenshot_captions=['MySQL join results.'])
    path,_=flow.build_word_report(upload,SimpleNamespace(id=1,output_name='sql',results=[result]))
    doc=Document(path)
    assert [p.text for p in doc.paragraphs if p.text]==['Original manual cover and long instructions','Experiment 1 Joins','MySQL join results.']
    assert not doc.tables
    assert doc.sections[-1].page_width>doc.sections[-1].page_height


def test_pdf_manual_pages_precede_compact_output_and_screenshot(tmp_path,monkeypatch):
    monkeypatch.setattr(settings,'REPORT_DIR',str(tmp_path/'reports'))
    source=tmp_path/'manual.pdf'
    Image.new('RGB',(300,400),'white').save(source,'PDF',append_images=[Image.new('RGB',(300,400),'lightblue')],save_all=True)
    evidence=tmp_path/'output.png';Image.new('RGB',(600,300),'navy').save(evidence)
    upload=SimpleNamespace(file_path=str(source),file_type='pdf',original_filename=source.name)
    result=dict(id=1,language='python',status='completed',question='Experiment 1: Print a result',
        screenshot_paths=[str(evidence)],screenshot_captions=['Execution output'])
    path,_=flow.build_word_report(upload,SimpleNamespace(id=4,mode='code_only',output_name='pdf_input',results=[result]))
    doc=Document(path)
    assert len(doc.inline_shapes)==3
    for shape in list(doc.inline_shapes)[:2]:
        assert shape.width < doc.sections[0].page_width
        assert shape.height < doc.sections[0].page_height
    texts=[p.text for p in doc.paragraphs if p.text]
    assert texts[0]=='Uploaded input: manual.pdf'
    assert texts[-2:]==['Experiment 1: Print a result','Execution output']


def test_colab_report_uses_compact_unlabelled_screenshots(tmp_path, monkeypatch):
    _,image,upload=fixture_report(tmp_path,monkeypatch)
    result=dict(id=1,language='colab',status='completed',question='Experiment 1 Notebook',
        screenshot_paths=[str(image),str(image)],
        screenshot_captions=['Colab code — cell 1, lines 1–18','Colab execution output — cell 1, part 1'])
    path,_=flow.build_word_report(upload,SimpleNamespace(id=1,output_name='notebook',results=[result]))
    doc=Document(path)
    assert len(doc.inline_shapes)==2
    assert all(shape.width <= 6.25 * 914400 for shape in doc.inline_shapes)
    assert not any('Colab-style' in p.text or 'lines 1–18' in p.text for p in doc.paragraphs)


def test_failed_report_keeps_a_short_diagnostic(tmp_path,monkeypatch):
    _,_,upload=fixture_report(tmp_path,monkeypatch)
    result=dict(id=1,language='java',status='failed',question='Compile a Java class',error='Compiler rejected the source.',screenshot_paths=[])
    path,_=flow.build_word_report(upload,SimpleNamespace(id=1,output_name='failed',results=[result]))
    texts=[p.text for p in Document(path).paragraphs if p.text]
    assert texts[0]=='Original manual cover and long instructions'
    assert len(texts)==3
    assert 'has not passed verification' in texts[2] and 'Compiler rejected' in texts[2]
    assert 'Execution evidence unavailable.' in texts[2]
    assert 'Browser evidence unavailable.' not in texts[2]


@pytest.mark.parametrize(('language','caption','expected'),[
    ('python','Rendered IDLE source preview — main.py','Program (IDLE-style preview) — main.py'),
    ('java','Rendered Notepad source preview — Main.java','Java program (Notepad-style preview) — Main.java'),
    ('c','Rendered Code::Blocks source preview — main.c','C program (Code::Blocks-style preview) — main.c'),
    ('cpp','Rendered Code::Blocks source preview — main.cpp','C++ program (Code::Blocks-style preview) — main.cpp'),
    ('html','VS Code-style source preview — index.html','Web page code (VS Code-style preview) — index.html'),
    ('colab','Colab code — cell 1, lines 1–18','Notebook code (Colab-style preview) — cell 1, lines 1–18'),
    ('sql','MySQL Workbench Query 1: SELECT 1 [MySQL Workbench-style rendered interface]',
        'Query 1: SELECT 1 [MySQL Workbench-style rendered interface]'),
    ('python','Simulated output — not verified','Simulated output — not verified'),
])
def test_lab_captions_keep_the_kind_and_scope_of_evidence(language,caption,expected):
    assert evidence_caption(language,caption)==expected


def test_report_includes_only_the_supplied_aim_without_extra_prose(tmp_path,monkeypatch):
    _,image,upload=fixture_report(tmp_path,monkeypatch)
    result=dict(id=1,language='python',status='completed',
        question='Experiment 1 Inheritance\nAim: Demonstrate inheritance using a class.\nOther lengthy instructions.',
        answer='An invented conclusion must not appear.',screenshot_paths=[str(image)],
        screenshot_captions=['Captured process transcript'])
    path,_=flow.build_word_report(upload,SimpleNamespace(id=1,output_name='student',results=[result]))
    doc=Document(path)
    assert [p.text for p in doc.paragraphs if p.text]==[
        'Original manual cover and long instructions',
        'Experiment 1 Inheritance','Aim: Demonstrate inheritance using a class.',
        'Output (recorded console)']
    assert len(doc.inline_shapes)==1


@pytest.mark.parametrize('missing',['absent','empty'])
def test_success_cannot_hide_missing_evidence(tmp_path,monkeypatch,missing):
    _,_,upload=fixture_report(tmp_path,monkeypatch)
    result=dict(id=1,language='python',status='completed',question='Print a number',
        screenshot_paths=[str(tmp_path/'missing.png')] if missing=='absent' else [])
    with pytest.raises(ValueError):
        flow.build_word_report(upload,SimpleNamespace(id=1,output_name='missing',results=[result]))

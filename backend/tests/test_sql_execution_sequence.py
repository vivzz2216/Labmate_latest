import pytest
from app.services.lab_capture import capture_sql


@pytest.mark.asyncio
async def test_sql_grids_follow_executed_select_not_future_table_data():
    code='''CREATE DATABASE grouped_queries_lab;
USE grouped_queries_lab;
DROP TABLE IF EXISTS customers;
CREATE TABLE customers(id INT PRIMARY KEY, name VARCHAR(20));
INSERT INTO customers VALUES (1,'Anita'),(2,'Rahul');
SELECT * FROM customers;
DROP TABLE IF EXISTS products;
CREATE TABLE products(id INT PRIMARY KEY, name VARCHAR(20));
INSERT INTO products VALUES (1,'Notebook');
SELECT * FROM products;
SELECT * FROM customers;
SELECT * FROM products WHERE id=99;'''
    result=await capture_sql(code,filename='sequence.sql',objective='Complex queries using GROUP BY on a chosen system')
    assert result.success,result.error
    frames=[f for f in result.verification['evidence_frames'] if f['kind']=='database']
    by_index={f['statement_index']: f for f in frames}
    assert set(by_index)=={6,10,11,12}
    assert by_index[6]['active_result_rows']==[{'id':1,'name':'Anita'},{'id':2,'name':'Rahul'}]
    assert by_index[10]['active_result_rows']==[{'id':1,'name':'Notebook'}]
    assert by_index[11]['active_result_rows']==by_index[6]['active_result_rows']
    assert by_index[12]['active_result_rows']==[]


def test_export_embeds_current_sql_images_in_execution_order(tmp_path,monkeypatch):
    import hashlib
    import zipfile
    from types import SimpleNamespace
    from PIL import Image
    from lxml import etree
    from app.config import settings
    from app.services.compact_report import build_compact_report
    from app.services.storage_service import storage_service
    monkeypatch.setattr(settings,'REPORT_DIR',str(tmp_path))
    monkeypatch.setattr(storage_service,'sync_file',lambda path:None)
    paths=[]
    for name,color in [('source','white'),('customers','blue'),('products','green')]:
        p=tmp_path/(name+'.png');Image.new('RGB',(900,520),color).save(p);paths.append(str(p))
    frames=[{'path':paths[0],'kind':'source_preview'},
            {'path':paths[1],'kind':'database','statement_index':6},
            {'path':paths[2],'kind':'database','statement_index':10}]
    result={'id':1,'language':'sql','question':'SQL practical','status':'completed',
            'screenshot_paths':[paths[0],paths[2],paths[1]],'verification':{'evidence_frames':frames}}
    upload=SimpleNamespace(file_type='txt',file_path='',original_filename='manual.txt')
    path,_=build_compact_report(upload,SimpleNamespace(results=[result],output_name='test',id=99))
    with zipfile.ZipFile(path) as z:
        ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
        rels={r.get('Id'):r.get('Target') for r in etree.fromstring(z.read('word/_rels/document.xml.rels'))}
        embeds=etree.fromstring(z.read('word/document.xml')).findall('.//a:blip',ns)
        hashes=[hashlib.sha256(z.read('word/'+rels[e.get('{'+ns['r']+'}embed')])).hexdigest() for e in embeds]
        from pathlib import Path
        assert hashes==[hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in [paths[0],paths[1],paths[2]]]

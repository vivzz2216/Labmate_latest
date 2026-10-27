import os
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from app.services.notebook_runtime import ColabPythonKernel
from app.services.sql_runtime import SQLSession


def test_sql_nulls_expressions_filters_joins_and_transactions():
    lab=SQLSession()
    try:
        assert lab.execute_script('CREATE TABLE t(id INTEGER PRIMARY KEY,v INTEGER);INSERT INTO t VALUES(1,NULL),(2,10),(3,20);')['success']
        assert lab.execute('SELECT AVG(v) AS avg, MIN(v) AS min FROM t')['rows']==[{'avg':15.0,'min':10}]
        assert lab.execute('SELECT v*2 AS doubled FROM t ORDER BY id LIMIT 1,2')['rows']==[{'doubled':20},{'doubled':40}]
        assert lab.execute('SELECT id FROM t WHERE v IS NULL')['rows']==[{'id':1}]
        assert lab.execute('SELECT COUNT(*) AS n FROM t GROUP BY v HAVING v>=10')['rows']==[{'n':1},{'n':1}]
        assert lab.execute('SELECT a.id,b.v FROM t a JOIN t b ON a.id=b.id ORDER BY a.id')['rows'][1]=={'id':2,'v':10}
        assert lab.execute_script('BEGIN;UPDATE t SET v=999 WHERE id=2;ROLLBACK;')['success']
        assert lab.execute('SELECT v FROM t WHERE id=2')['rows']==[{'v':10}]
        assert not lab.execute('SELECT missing FROM t')['success']
        assert not lab.execute('THIS IS NOT SQL')['success']
        assert not lab.execute("ATTACH DATABASE ':memory:' AS other")['success']
        assert not lab.execute('PRAGMA foreign_keys=OFF')['success']
    finally:lab.close()


def test_mysql_ddl_implicit_commit_foreign_keys_and_query_deadline():
    lab=SQLSession(timeout=.05)
    try:
        assert lab.execute_script('BEGIN;CREATE TABLE gone(id INT);ROLLBACK;')['success']
        # MySQL DDL implicitly commits; the former SQLite expectation was incorrect.
        assert lab.execute('SELECT * FROM gone')['success']
        assert lab.execute_script('CREATE TABLE p(id INTEGER PRIMARY KEY);CREATE TABLE c(pid INT REFERENCES p(id));')['success']
        assert not lab.execute('INSERT INTO c VALUES(99)')['success']
        result=lab.execute('WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<500) SELECT SUM(a.x*b.x*c.x) FROM n a CROSS JOIN n b CROSS JOIN n c')
        assert not result['success'] and 'interrupted' in result['error']
        assert lab.execute('SELECT 2+3 AS n')['rows']==[{'n':5}]
    finally:lab.close()


def test_notebook_state_datasets_stderr_and_environment(monkeypatch,tmp_path):
    monkeypatch.setenv('LABMATE_AUDIT_MARKER','must-not-reach-worker')
    original_cwd=os.getcwd()
    kernel=ColabPythonKernel(teacher_datasets={'data/teacher.csv':'v\n10\n20\n'},timeout_sec=45)
    try:
        first=kernel.execute_cell('x=10\nprint(x)')
        assert first['error'] is None,first
        assert first['stdout']=='10'
        second=kernel.execute_cell('x+=5\nprint(x)')
        assert second['stdout']=='15',second
        result=kernel.execute_cell('print(pd.read_csv("/content/data/teacher.csv")["v"].tolist())')
        assert result['stdout']=='[10, 20]',result
        result=kernel.execute_cell('open("/content/data/teacher.csv","w").write("v\\n999\\n")')
        assert not result['error'],result
        result=kernel.execute_cell('print(pd.read_csv("data/teacher.csv")["v"].tolist())')
        assert result['stdout']=='[999]',result
        model=kernel.execute_cell('from sklearn.linear_model import LinearRegression\nm=LinearRegression().fit([[1],[2],[3]],[2,4,6])\nprint(round(m.predict([[4]])[0]))')
        assert model['stdout']=='8' and not model['error'],model
        result=kernel.execute_cell('import sys\nprint("warning text",file=sys.stderr)\nprint(pd.io.common.os.environ.get("LABMATE_AUDIT_MARKER","missing"))')
        assert result['stdout']=='missing' and result['stderr']=='warning text',result
        missing=kernel.execute_cell('pd.read_csv("missing.csv")')
        assert 'Upload the referenced dataset' in missing['error'] and '<colab-cell>' in missing['error'],missing
        outside=kernel.execute_cell('open("../outside.txt","w").write("bad")')
        assert 'PermissionError' in outside['error'],outside
        assert os.getcwd()==original_cwd
    finally:kernel.cleanup()


def test_notebook_timeout_terminates_worker_and_allows_reset():
    kernel=ColabPythonKernel()
    try:
        ready=kernel.execute_cell('print("ready")')
        assert not ready['error'],ready
        process=kernel._process
        started=time.monotonic()
        result=kernel.execute_cell('while True: pass',timeout_sec=.2)
        assert 'time limit' in result['error'],result
        assert time.monotonic()-started<8 and process.poll() is not None
        kernel.reset()
        assert kernel.execute_cell('print(7//2)')['stdout']=='3'
    finally:kernel.cleanup()


def test_notebook_chained_inplace_update_fails_instead_of_claiming_clean_data():
    kernel=ColabPythonKernel(teacher_datasets={'marks.csv':'score\n10\n\n20\n'})
    try:
        result=kernel.execute_cell('import pandas as pd\npd.options.mode.copy_on_write=True\ndf=pd.read_csv("marks.csv",skip_blank_lines=False)\ndf["score"].fillna(15,inplace=True)\nprint("cleaned")')
        assert result['error'] and 'ChainedAssignmentError' in result['error'],result
        assert 'cleaned' not in result['stdout']
        fixed=kernel.execute_cell('df["score"] = df["score"].fillna(15)\nprint(df["score"].isna().sum())\nprint(df["score"].sum())')
        assert not fixed['error'],fixed
        assert fixed['stdout']=='0\n45.0',fixed
    finally:kernel.cleanup()


def test_concurrent_notebooks_keep_both_plots():
    kernels=[ColabPythonKernel(),ColabPythonKernel()]
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda k:k.execute_cell('plt.plot([1,2],[3,4]);plt.show()'),kernels))
        assert all(not r['error'] and len(r['plots'])==1 for r in results),[{k:v for k,v in r.items() if k!='plots'} for r in results]
    finally:
        for kernel in kernels:kernel.cleanup()


def test_sql_conditions_limit_and_like_are_sql_not_javascript():
    lab=SQLSession()
    try:
        assert lab.execute_script("CREATE TABLE t(id INT,like_count INT,note TEXT);INSERT INTO t VALUES(1,NULL,'a.b'),(2,8,'axb'),(3,10,'a >= b OR c');")['success']
        assert lab.execute('SELECT id FROM t WHERE like_count IS NULL')['rows']==[{'id':1}]
        assert lab.execute('SELECT id FROM t WHERE like_count BETWEEN 8 AND 10 ORDER BY id LIMIT 0,1000')['rows']==[{'id':2},{'id':3}]
        assert lab.execute("SELECT id FROM t WHERE note LIKE 'a.b'")['rows']==[{'id':1}]
        assert lab.execute("SELECT id FROM t WHERE note='a >= b OR c'")['rows']==[{'id':3}]
        assert lab.execute('SELECT id FROM t WHERE id IN(1,3) ORDER BY id')['rows']==[{'id':1},{'id':3}]
    finally:lab.close()


def test_notebook_upload_bridge_preserves_files_between_cell_requests():
    from app.services.colab_pipeline import notebook_bridge
    kernel=ColabPythonKernel()
    try:
        uploads={'t.csv':'v\n1\n'}
        first=notebook_bridge(kernel,{'datasets':uploads,'code':'print(pd.read_csv("t.csv")["v"].iloc[0])'})
        assert first['stdout']=='1' and not first['error'],first
        changed=notebook_bridge(kernel,{'datasets':uploads,'code':'open("t.csv","w").write("v\\n2\\n")'})
        assert not changed['error'],changed
        later=notebook_bridge(kernel,{'datasets':uploads,'code':'print(pd.read_csv("t.csv")["v"].iloc[0])'})
        assert later['stdout']=='2',later
    finally:kernel.cleanup()


def test_invalid_student_dataset_does_not_abort_the_next_job(monkeypatch,tmp_path):
    from app.services import colab_pipeline
    monkeypatch.setattr(colab_pipeline,'render_and_capture_colab',lambda *args,**kw:(True,1600,900))
    queue=colab_pipeline.ColabExecutionQueue(max_workers=2)
    try:
        results=queue.run_batch_concurrent([
            {'student_name':'Invalid','datasets':99,'code':'print(1)','screenshot_path':str(tmp_path/'bad.png')},
            {'student_name':'Valid','code':'print(3)','screenshot_path':str(tmp_path/'good.png')}])
        assert not results[0]['success'] and results[1]['success'],results
        assert results[1]['cells'][0]['stdout']=='3'
    finally:queue.close()

import asyncio
from pathlib import Path
import pytest
from playwright.async_api import async_playwright
from app.services.browser_capture import launch_capture_browser
from app.services.lab_resources import resource_file,allowed_resource
from app.services.sql_runtime import SQLSession
from app.services.notebook_runtime import ColabPythonKernel
from app.services.colab_pipeline import display_cell


@pytest.mark.asyncio
async def test_real_sql_bridge_handles_previous_failure_cases():
    lab=SQLSession()
    async with async_playwright() as pw:
        browser=await launch_capture_browser(pw)
        try:
            page=await browser.new_page()
            await page.route('https://**/*',lambda route:route.abort())
            await page.expose_function('pySqliteBridge',lab.execute)
            await page.goto(resource_file('sql_workbench','index.html').as_uri(),wait_until='domcontentloaded')
            setup='CREATE TABLE t(id INT,v INT);INSERT INTO t VALUES(1,NULL),(2,10),(3,20);'
            tests=[('SELECT AVG(v) AS average,MIN(v) AS minimum FROM t',[{'average':15.0,'minimum':10}]),
                ('SELECT v*2 AS doubled FROM t ORDER BY id LIMIT 1,2',[{'doubled':20},{'doubled':40}]),
                ('SELECT a.id,b.v FROM t a JOIN t b ON a.id=b.id ORDER BY a.id',[{'id':1,'v':None},{'id':2,'v':10},{'id':3,'v':20}]),
                ('BEGIN;UPDATE t SET v=999 WHERE id=2;ROLLBACK;SELECT v FROM t WHERE id=2',[{'v':10}])]
            for query,expected in tests:
                await page.evaluate('window.MySQLWorkbench.reset()');lab.reset()
                assert (await page.evaluate('(sql)=>window.MySQLWorkbench.executeSQL(sql,true)',setup))['success']
                result=await page.evaluate('(sql)=>window.MySQLWorkbench.executeSQL(sql,true)',query)
                assert result['success'],result
                grid=await page.evaluate('window.MySQLWorkbench.getResultGridData()')
                assert grid['rows']==expected,(query,grid)
            failed=await page.evaluate('window.MySQLWorkbench.executeSQL("SELECT missing FROM t",true)')
            assert not failed['success']
            assert not (await page.evaluate('window.MySQLWorkbench.executeSQL("THIS IS NOT SQL",true)'))['success']
        finally:
            await browser.close();lab.close()


@pytest.mark.asyncio
async def test_notebook_run_uses_actual_python_and_sanitizes_html():
    kernel=ColabPythonKernel()
    async with async_playwright() as pw:
        browser=await launch_capture_browser(pw)
        try:
            page=await browser.new_page()
            await page.route('https://**/*',lambda route:route.abort())
            async def bridge(request):return display_cell(await asyncio.to_thread(kernel.execute_cell,request['code']))
            await page.expose_function('pyColabBridge',bridge)
            await page.goto(resource_file('google_colab','index.html').as_uri(),wait_until='domcontentloaded')
            await page.evaluate('window.ColabNotebook.loadCells([{type:"code",code:"print(7//2)"}])')
            await page.evaluate('window.ColabNotebook.runCell(0)')
            assert (await page.locator('.cell-output-content').inner_text()).strip()=='3'
            await page.evaluate('window.ColabNotebook.loadCells([{type:"code",code:"import sys\\nprint(\\\"visible warning\\\",file=sys.stderr)"}])')
            await page.evaluate('window.ColabNotebook.runCell(0)')
            assert 'visible warning' in await page.locator('.cell-output-content').inner_text()
            await page.evaluate('window.ColabNotebook.addMarkdownCell(`<img src=x onerror="window.auditXss=true"><script>window.auditXss=true</script><b>Safe text</b>`)')
            assert not await page.evaluate('!!window.auditXss')
            assert await page.get_by_text('Safe text',exact=True).count()==1
            assert not await page.locator('[onerror]').count()
        finally:
            await browser.close();kernel.cleanup()

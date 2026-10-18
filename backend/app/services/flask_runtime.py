"""Temporary loopback WSGI app; reuse the guarded browser and bounded assertions."""
import asyncio
import importlib.util
import sys
from pathlib import Path
import uuid


LAUNCHER='''import pathlib,runpy,secrets,sys
from flask import Flask
from werkzeug.serving import make_server
root=pathlib.Path(sys.argv[1]).resolve()
sys.path.insert(0,str(root))
# The trusted host owns binding, debug mode and the server lifecycle.
Flask.run=lambda *a,**k:None
namespace=runpy.run_path(str(root/sys.argv[2]),run_name="__labmate_flask__")
apps=[v for v in namespace.values() if isinstance(v,Flask)]
apps=list({id(v):v for v in apps}.values())
if len(apps)!=1:raise ValueError("Define exactly one global Flask app.")
app=apps[0]
app.debug=False
app.config.update(TESTING=False,PROPAGATE_EXCEPTIONS=False)
if not app.secret_key:app.secret_key=secrets.token_hex(32)
make_server("127.0.0.1",int(sys.argv[3]),app,threaded=True).serve_forever()
'''


async def capture_flask(engine,directory,config):
    from .runtime_engine import RuntimeResult,start_process,collect_output,kill_process_tree,write_project_files
    from .web_project import validate_project
    from .web_runtime import reserve_port
    validate_project({'files':[{'path':n,'content':c} for n,c in config['project_files'].items()],
        'project_type':'flask','entrypoint':config['entrypoint']})
    if importlib.util.find_spec('flask') is None:
        return RuntimeResult(False,error='Flask 3.1.3 is not installed in the execution environment.',exit_code=127)
    write_project_files(directory,config['project_files'])
    # Keep the launcher outside the student project and its template root.
    launcher=directory.parent/('_flask_host_'+uuid.uuid4().hex+'.py');launcher.write_text(LAUNCHER,encoding='utf-8')
    reservation,port=reserve_port();process=None;streams=[];result=None
    try:
        reservation.close()
        process=await start_process([sys.executable,'-I','-u',launcher,directory,config['entrypoint'],str(port)],directory,
            resource_limits={'max_memory_bytes':512*1024*1024,'max_cpu_seconds':30})
        process.stdin.close()
        streams=[asyncio.create_task(collect_output(process.stdout,process)),asyncio.create_task(collect_output(process.stderr,process))]
        import httpx
        async with httpx.AsyncClient(timeout=.5,trust_env=False,follow_redirects=False) as client:
            for _ in range(60):
                if process.returncode is not None:raise ValueError('Flask exited before its WSGI server became ready.')
                try:
                    if (await client.get(f'http://127.0.0.1:{port}/')).status_code<500:break
                except httpx.TransportError:pass
                await asyncio.sleep(.1)
            else:raise ValueError('Flask did not become ready within six seconds.')
        result=await engine._capture_html(None,config.get('browser_tests'),config.get('interaction_is_required',True),page_url=f'http://127.0.0.1:{port}')
        result.stages={'server':'passed','render':'passed' if result.success else 'failed','browser':(result.verification or {}).get('status','failed')}
        return result
    except Exception as error:
        result=RuntimeResult(False,error=str(error)[:1500],exit_code=1,stages={'server':'failed'});return result
    finally:
        if process is not None:await kill_process_tree(process)
        logs=await asyncio.gather(*streams,return_exceptions=True)
        if result is not None and not result.success:
            result.error+='\n'+'\n'.join(item[0][-1800:] for item in logs if isinstance(item,tuple))
        reservation.close();launcher.unlink(missing_ok=True)

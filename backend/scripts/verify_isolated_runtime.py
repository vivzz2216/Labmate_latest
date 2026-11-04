"""No model calls: exercise actual code execution through the configured isolated worker."""
import asyncio
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.services.runtime_engine import runtime_engine


async def main():
    settings.EXECUTION_ISOLATION = 'required'
    samples = [
        ('python', 'print(2+3)', {}),
        ('c', '#include <stdio.h>\nint main(){printf("5\\n");return 0;}', {}),
        ('cpp', '#include <iostream>\nint main(){std::cout << 5 << std::endl;}', {}),
        ('java', 'public class Main { public static void main(String[] args) {System.out.println(5);} }', {}),
        ('node', 'console.log(2+3);', {}),
        ('html', '<label>First<input id="a" placeholder="First"></label><label>Second<input id="b" placeholder="Second"></label><button onclick="document.getElementById(\'r\').textContent=Number(a.value)+Number(b.value)">Add</button><output id="r"></output>',
         {'interaction_is_required':True, 'browser_tests':[{'name':'Add numbers','actions':[
             {'action':'fill','locator_type':'placeholder','locator':'First','role':'','value':'2'},
             {'action':'fill','locator_type':'placeholder','locator':'Second','role':'','value':'3'},
             {'action':'click','locator_type':'role','locator':'Add','role':'button','value':''}], 'expected_text':['5']}]}),
        ('react', 'import React from "react"; import {createRoot} from "react-dom/client"; createRoot(document.getElementById("root")).render(<h1>Isolated React works</h1>);', {}),
        ('colab', 'print(2+3)', {'project_config': {'colab_theme':'light'}}),
        ('c', '#include <stdio.h>\nint main(){FILE*f=fopen("/var/lib/labmate-outside-canary.txt","r");if(f){puts("BOUNDARY FAILED");fclose(f);return 1;}puts("DENIED");return 0;}', {}),
    ]
    flask_code = 'from flask import Flask\napp=Flask(__name__)\n@app.route("/")\ndef home():\n    return "<h1>Isolated Flask works</h1>"\n'
    samples.append(('python', flask_code, {'objective':'Flask application', 'project_config':{
        'project_type':'flask', 'entrypoint':'app.py', 'project_files':{'app.py':flask_code}, 'interaction_is_required':False}}))
    gui_code = 'import javax.swing.*; public class Main { public static void main(String[] args) { JFrame f=new JFrame("Test"); f.add(new JButton("Ready")); f.setSize(400,200); f.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE); f.setVisible(true); }}'
    samples.append(('java', gui_code, {'objective':'Java Swing interface', 'browser_tests':[{
        'version':2, 'name':'Window ready', 'requirement_ids':[], 'viewport':{'width':1024,'height':768},
        'steps':[{'action':'assert_visible','locator_type':'text','locator':'Ready','role':'','value':''}]}]}))
    rows = []
    for language, code, options in samples:
        case = 'flask' if options.get('project_config', {}).get('project_type') == 'flask' else 'java-ui' if 'Swing' in options.get('objective', '') else 'c-canary' if 'outside-canary' in code else language
        if sys.argv[1:] and case not in sys.argv[1:]: continue
        started = time.perf_counter()
        result = await runtime_engine.execute(code, language, **options)
        row = {'case':case, 'language':language, 'success':result.success, 'error':result.error,
               'output':result.output[:300], 'screenshots':len(result.screenshots),
               'verification':(result.verification or {}).get('status'), 'stages':result.stages,
               'seconds':round(time.perf_counter()-started,2)}
        rows.append(row)
        print(json.dumps(row), flush=True)
    target = Path(__file__).resolve().parents[1] / ('audit_artifacts/isolated-runtime/runtime-smoke-retest.json' if sys.argv[1:] else 'audit_artifacts/isolated-runtime/runtime-smoke.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(rows, indent=2))
    if not all(r['success'] for r in rows): raise SystemExit(1)


if __name__ == '__main__': asyncio.run(main())

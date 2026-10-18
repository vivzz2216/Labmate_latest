"""Bounded web project manifests and requirement-to-evidence contracts."""
import json
from copy import deepcopy
import posixpath
import re
import base64
from urllib.parse import unquote
from xml.etree import ElementTree
from pathlib import PurePosixPath
from jsonschema import validate, ValidationError

from .generation_service import GenerationError, generation_service, strict_json_schema
from .web_generation_protocol import INSTRUCTIONS, canonical_web_data


STEP_SCHEMA = {"type": "OBJECT", "properties": {
    "action": {"type": "STRING", "enum": ["fill", "click", "click_confirm", "select", "reload", "goto", "reset_storage", "assert_visible", "assert_absent", "assert_count", "assert_value", "assert_attribute", "assert_order", "assert_http", "assert_url", "assert_checked", "assert_no_overflow", "screenshot"]},
    "locator_type": {"type": "STRING", "enum": ["role", "label", "placeholder", "text", "testid", "page"]},
    "locator": {"type": "STRING", "description": "Exact accessible name or text of the DOM element. For assert_visible/assert_absent this is expected visible text, not value. Empty only for page operations."},
    "role": {"type": "STRING", "description": "Accessible role such as button/link only for locator_type role; otherwise empty."},
    "value": {"type": "STRING", "description": "Input text for fill, option LABEL for select, relative URL for goto, expected data for count/value/attribute/order/http assertions. Empty for click/assert_visible/assert_absent/screenshot/reload/reset_storage/assert_no_overflow."},
}, "required": ["action", "locator_type", "locator", "role", "value"]}
WEB_SCHEMA = {"type": "OBJECT", "properties": {
    "answer": {"type": "STRING"}, "language": {"type": "STRING", "enum": ["html", "react", "node"]},
    "project_type": {"type": "STRING", "enum": ["html", "react", "node", "fullstack"]},
    "entrypoint": {"type": "STRING"}, "server_entrypoint": {"type": "STRING"},
    "source_capture_files": {"type":"ARRAY","items":{"type":"STRING"},"description":"Choose up to three real files containing the experiment logic for code screenshots. React: actual components/state/routes, not mounting-only main.jsx or CSS. Node: server/routes/validation logic, not CSS/config. Long files are explicitly labelled first/last excerpts by the host."},
    "files": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "content": {"type": "STRING"}}, "required": ["path", "content"]}},
    "browser_tests": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "name": {"type": "STRING"},
        "requirement_ids": {"type": "ARRAY", "items": {"type": "STRING"}},
        "steps": {"type": "ARRAY", "items": STEP_SCHEMA},
        "viewport": {"type": "OBJECT", "properties": {"width": {"type": "INTEGER"}, "height": {"type": "INTEGER"}}, "required": ["width", "height"]},
    }, "required": ["name", "requirement_ids", "steps", "viewport"]}},
    "api_tests": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "name": {"type": "STRING"}, "path": {"type": "STRING"}, "method": {"type": "STRING"},
        "body_json": {"type": "STRING"}, "expected_status": {"type": "INTEGER"}, "expected_json": {"type": "STRING"},
    }, "required": ["name", "path", "method", "body_json", "expected_status", "expected_json"]}},
}, "required": ["answer", "language", "project_type", "entrypoint", "server_entrypoint", "files", "browser_tests", "api_tests"]}

# These are generic behavioral contracts, not implementations of particular labs.
FEATURES = {
    "calculation": r'calculator|add two numbers|sum of two numbers',
    "navigation": r"\bnavigation\b|\bnav\b",
    "routes": r"\b(?:routes?|routing|router)\b",
    "dynamic_route": r"\bdynamic route\b",
    "not_found": r"\bnot found\b|unknown (?:paths?|routes?)",
    "responsive": r"\bresponsive\b|\bmobile\b",
    "validation": r"\bvalidat(?:e|ion)\b|invalid (?:data|input)|reject blank",
    "success_state": r"success(?:ful)? (?:submission|message|state)|valid (?:data|input).*success",
    "create": r"\badd(?:ing)?\b.*\b(?:tasks?|notes?|events?)\b|\bcreate notes\b",
    "edit": r"\bedit(?:ing)?\b",
    "delete": r"\bdelet(?:e|ion|ing)\b",
    "complete": r"\bcomplet(?:e|ed)\b.*\btasks?\b|\badd, complete, delete\b",
    "filter": r"\bfilter(?:s|ing)?\b",
    "search": r"\bsearch(?:ing)?\b",
    "sort": r"\bsort\b",
    "count": r"matching count|matching items|\bcounts?\b",
    "empty": r"empty state|no.results|no results",
    "persistence": r"localstorage|persist|post.reload|across reload",
    "theme": r"\bthemes?\b",
    "toggle": r"show/hide|show or hide|biography|\btoggle\b",
    "fetch": r"\bfetch(?:es|ing)?\b",
    "loading": r"\bloading\b",
    "error_recovery": r"\bretry\b|controlled test mode|loading and error",
    "api": r"\bapi\b|server.side validation|http status",
}


def web_requirements(text, language):
    lowered = text.lower()
    # Conditional instructions shared by a whole manual must not invent form
    # validation requirements for a static portfolio or a routing-only page.
    objective=lowered.split('\ngeneral requirements\n',1)[0]
    features = [{"id": name, "text": name.replace("_", " "), "kind": "behavior"}
                for name, pattern in FEATURES.items() if re.search(pattern, objective)]
    if re.search(r'at least (?:eight|8)\b.*products', lowered):
        features.append({'id':'catalogue_items','text':'Assert at least eight actual product cards in the default catalogue','kind':'behavior','minimum_count':8})
    if language == "html" and re.search(r"external (?:css|stylesheet)", lowered):
        features.append({"id": "external_css", "text": "Deliver referenced external CSS", "kind": "source"})
    if re.search(r"semantic (?:html|elements|structure)", lowered):
        tags = []
        for line in text.splitlines():
            mentioned=[tag for tag in ('header','nav','main','section','article','footer') if re.search(r'\b'+tag+r'\b',line,re.I)]
            if len(mentioned)>=3: tags.extend(mentioned)
        features.append({"id": "semantic_html", "text": "Use semantic elements relevant to this page" + (': '+', '.join(sorted(set(tags))) if tags else ''), "kind": "source", 'tags':sorted(set(tags))})
    if re.search(r"alt text", lowered):
        features.append({"id": "image_alt", "text": "Image with meaningful alt", "kind": "source"})
    if re.search(r"components|props", lowered) and language in {"react", "node"}:
        features.append({"id": "components", "text": "Reusable components and props", "kind": "source"})
        names = sorted(set(re.findall(r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b', text))-{'JavaScript','TypeScript','ReactRouter','NodeJs'})
        if names: features.append({'id':'named_components','text':'Implement required named components: '+', '.join(names),'kind':'source','names':names})
    if re.search(r'stable keys|lists have keys', lowered):
        features.append({'id':'stable_keys','text':'Render mapped lists with stable keys, not array indices','kind':'source'})
    if re.search(r'through props|components use props',lowered):
        features.append({'id':'props','text':'Pass data into component parameters','kind':'source'})
    if re.search(r"startup (?:commands|steps|instructions)|setup requirements|commands needed", lowered):
        features.append({"id": "startup", "text": "Document startup commands", "kind": "source"})
    return features


def _resolves(files, name, reference):
    reference = reference.split("?")[0].split("#")[0]
    if not reference: return True
    target = posixpath.normpath(posixpath.join(posixpath.dirname(name), reference)) if not reference.startswith("/") else reference[1:]
    return any(candidate in files for candidate in [target, *(target+ext for ext in (".js", ".jsx", ".ts", ".tsx", ".json", ".css")), target+"/index.js", target+"/index.jsx"])


def validate_project(data):
    if not isinstance(data, dict): raise ValueError("Web generation must return a project object.")
    items = data.get("files")
    if not isinstance(items, list) or not 1 <= len(items) <= 20: raise ValueError("Web projects require 1–20 files.")
    files = {}
    for item in items:
        if not isinstance(item, dict) or set(item) != {"path", "content"}: raise ValueError("Invalid project file structure.")
        name, content = item["path"], item["content"]
        if not isinstance(name, str) or not isinstance(content, str): raise ValueError("Project files must be text.")
        path = PurePosixPath(name)
        if (not name or any(ord(c)<32 for c in name) or path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name or
            "node_modules" in path.parts or name.lower() in {n.lower() for n in files} or path.as_posix() != name or len(name)>160 or path.suffix not in {".html", ".css", ".js", ".jsx", ".cjs", ".mjs", ".json", ".md", ".svg", *(('.py',) if data.get('project_type')=='flask' else ())}):
            raise ValueError("Invalid, duplicate, or unsupported project filename: " + str(name)[:100])
        if path.name in {"package.json", "package-lock.json"} or "vite.config" in name:
            raise ValueError("Runtime packages/configuration are managed by LabMate; do not generate them.")
        files[name] = content
    if sum(len(v) for v in files.values()) > 600000: raise ValueError("Project exceeds the total text size limit.")
    for name, content in files.items():
        if data.get('project_type')=='flask' and name.endswith('.html') and re.search(r'__\w+__|\|\s*attr\b',content):
            raise ValueError('Flask templates cannot use runtime introspection.')
        svg_sources = [content] if name.endswith('.svg') else []
        for asset in re.findall(r'''["'](data:image/svg\+xml[^"']*)["']''',content):
            try:
                header,body=asset.split(',',1)
                svg_sources.append(base64.b64decode(body,validate=True).decode('utf-8') if ';base64' in header else unquote(body))
            except (ValueError,UnicodeError): raise ValueError('Invalid SVG data asset. Prefer a local .svg file with a proper SVG namespace.') from None
        for svg in svg_sources:
            try:
                if '<!DOCTYPE' in svg.upper() or '<!ENTITY' in svg.upper(): raise ValueError('SVG declarations are unsupported.')
                element=ElementTree.fromstring(svg)
                if element.tag != '{http://www.w3.org/2000/svg}svg': raise ValueError('SVG root must declare xmlns="http://www.w3.org/2000/svg".')
            except ElementTree.ParseError: raise ValueError('Malformed SVG asset; supply a valid local SVG with xmlns="http://www.w3.org/2000/svg".') from None
        references = re.findall(r"(?:from\s*|import\s*|require\s*\(\s*)['\"](\.[^'\"]+)['\"]", content) if name.endswith((".js", ".jsx", ".mjs", ".cjs")) else []
        if name.endswith(".html"):
            references += [value for value in re.findall(r'(?:src|href)=[\"\']([^\"\']+)', content) if not value.startswith(("#", "data:", "mailto:", "/api/", "/__labmate__/"))]
        for reference in references:
            if data.get('project_type')=='flask' and '{{' in reference:continue
            if reference.startswith(("https:", "http:", "//")): raise ValueError("External project assets are blocked; provide local or data assets.")
            # HTML navigation URLs are routes, not mandatory physical assets.
            if name.endswith('.html') and not PurePosixPath(reference).suffix: continue
            if not _resolves(files, name, reference): raise ValueError(f"Unresolved local import/asset in {name}: {reference}")
        if re.search(r'https?://(?:via\.placeholder|placehold\.|images\.unsplash|cdn\.)', content):
            raise ValueError("External placeholder/CDN assets are unavailable; use supplied SVG/data assets.")
    entry = data.get("entrypoint", "")
    if entry not in files: raise ValueError("The declared project entrypoint is missing.")
    kind = data.get("project_type")
    if kind not in {"html", "react", "node", "fullstack", "flask"}: raise ValueError("Unsupported project type.")
    if kind=='flask':
        if not entry.endswith('.py'):raise ValueError('Flask needs a Python entrypoint defining a global app.')
        from ..security.generated_code import validate_generated_code
        modules={PurePosixPath(n).stem for n in files if n.endswith('.py')}
        for name,content in files.items():
            if name.endswith('.py'):
                validate_generated_code(content,'python',capability='flask',local_modules=modules)
                for template in re.findall(r"render_template\(\s*['\"]([^'\"]+)['\"]",content):
                    if 'templates/'+template not in files:raise ValueError('Missing Flask template: '+template)
    server = data.get("server_entrypoint", "")
    if kind in {'react', 'fullstack'} and ('index.html' not in files or not entry.endswith(('.jsx','.js'))):
        raise ValueError('React projects need index.html and a declared JavaScript/JSX entrypoint; every referenced module must be supplied.')
    if kind == "fullstack" and (server not in files or not server.endswith((".cjs", ".mjs", ".js"))):
        raise ValueError("Full-stack projects require a separate Node server entrypoint.")
    if kind in {"node", "fullstack"}:
        backend = files[server if kind == "fullstack" else entry]
        if re.search(r"return\s*\(?\s*<[A-Za-z]|\bclassName=", backend):
            raise ValueError("Raw React JSX cannot run in the Node server entrypoint.")
    return {"project_files": files, "project_type": kind, "entrypoint": entry, "server_entrypoint": server}


def source_checks(requirements, project):
    files = project["project_files"]
    combined = "\n".join(files.values())
    checks = {}
    for requirement in requirements:
        name = requirement["id"]
        if name == "external_css": checks[name] = any(n.endswith('.css') for n in files) and bool(re.search(r'<link[^>]+stylesheet', combined, re.I))
        if name == "semantic_html": checks[name] = all(re.search(rf'<{tag}\b', combined, re.I) for tag in requirement.get('tags', [])) if requirement.get('tags') else bool(re.search(r'<(?:main|article|section|form|nav)\b',combined,re.I))
        if name == "image_alt": checks[name] = bool(re.search(r'<img\b[^>]*\balt\s*=\s*(?:[\"\'][^\"\']+|\{[^}]+\})', combined, re.I))
        if name == "components": checks[name] = len(re.findall(r'(?:function\s+|(?:const|class)\s+)([A-Z]\w+)', combined)) >= 2
        if name == 'named_components': checks[name] = all(re.search(r'(?:function\s+|(?:const|class)\s+)'+re.escape(component)+r'\b',combined) for component in requirement['names'])
        if name == 'stable_keys': checks[name] = bool(re.search(r'\.map\s*\(',combined) and re.search(r'\bkey\s*=',combined) and not re.search(r'key\s*=\s*\{\s*(?:index|idx|i)\s*\}',combined))
        if name == 'props': checks[name] = bool(re.search(r'(?:function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*=\s*\()\s*[^)\s][^)]*\)',combined))
        if name == "startup": checks[name] = any(n.lower().endswith('.md') and (re.search(r'(npm|npx|node|python)\s+', c) or project['project_type']=='html' and re.search(r'open\b.*\b(?:html|browser)\b',c,re.I)) for n,c in files.items())
    return checks


def api_tests(data):
    tests = []
    if len(data.get("api_tests", [])) > 16: raise ValueError("At most sixteen API scenarios are allowed.")
    for test in data.get("api_tests", []):
        record = {key: test[key] for key in ("name", "path", "method", "expected_status")}
        if test.get("body_json"): record["json"] = json.loads(test["body_json"])
        if test.get("expected_json"): record["expected_json"] = json.loads(test["expected_json"])
        tests.append(record)
    return tests




async def generate_web_project(question, language, on_retry=None, previous=None, failure="", additional_instructions=""):
    requirements = web_requirements(question+'\n'+additional_instructions, language)
    prompt = f"Language: {language}\nOriginal complete experiment:\n{question}\nRequirement contract:\n{json.dumps(requirements)}"
    if additional_instructions:prompt+='\nAdditional instructions (separate from the original experiment):\n'+additional_instructions
    if failure:
        prompt += '\nActual failure to correct in the complete replacement response:\n' + failure[:5000]
    if isinstance(previous,dict):
        # Failed provider drafts are untrusted and may violate the manifest
        # schema. They must not crash the next attempt before the model is called.
        prior_files=previous.get('files')
        prior_files=[f for f in prior_files if isinstance(f,dict)] if isinstance(prior_files,list) else []
        names=[f['path'] for f in prior_files if isinstance(f.get('path'),str)]
        prompt += "\nRegenerate the complete files AND tests together from the original requirements. Previous file names: " + json.dumps(names[:20])[:2000]
        important={value for value in (previous.get('entrypoint'),previous.get('server_entrypoint')) if isinstance(value,str)}
        snippets=[f['path']+'\n'+f['content'][:6000] for f in prior_files if isinstance(f.get('path'),str) and f['path'] in important and isinstance(f.get('content'),str)]
        prompt+='\nPrevious primary source excerpts (correct the actual code/test mismatch, regenerate complete files):\n'+'\n'.join(snippets)[:8000]
    schema=deepcopy(WEB_SCHEMA)
    objective=re.split(r'\ngeneral requirements\n',question,maxsplit=1,flags=re.I)[0]
    # A report preference mentioning React screenshots must not turn an
    # Express-only assignment into a React + Node application.
    extra_client=bool(re.search(r'\b(?:build|create|add|implement|use)\b.{0,40}\breact\s+(?:frontend|client|ui)\b',additional_instructions,re.I))
    kind='flask' if language=='python' else 'fullstack' if language=='node' and (re.search(r'\breact\b',objective,re.I) or extra_client) else language
    keys={'answer','files','entrypoint','source_capture_files'}
    if kind!='node': keys.add('browser_tests')
    if language=='node': keys.add('api_tests')
    if kind=='fullstack': keys.add('server_entrypoint')
    schema['properties']={k:v for k,v in schema['properties'].items() if k in keys}
    schema['required']=list(schema['properties'])
    behavior_ids=[r['id'] for r in requirements if r['kind']=='behavior']
    if behavior_ids and 'browser_tests' in schema['properties']:
        schema['properties']['browser_tests']['items']['properties']['requirement_ids']['items']['enum']=behavior_ids
    provider_schema=deepcopy(schema)
    provider_schema['properties']['readme']={'type':'STRING','description':'Required startup instructions in Markdown. HTML: open the supplied entry HTML file in a browser. React: npm install react@18.2.0 react-dom@18.2.0 react-router-dom@6.30.1 vite@5.4.21 then npx vite. Explain any required API/mock service; fullstack needs separate Node and Vite startup with matching local API proxy. No package.json is supplied. Do not claim verification.'}
    if kind=='flask':
        provider_schema['properties']['readme']['description']='Required Flask startup instructions in Markdown: python -m pip install Flask==3.1.3, then flask --app app run. List the supplied Python entrypoint, templates and static assets. No Node, Vite or npm setup is required. Do not claim verification.'
    provider_schema['required']=[*provider_schema['required'],'readme']
    if 'browser_tests' in provider_schema['properties']:
        from .browser_scenarios import ROLES
        provider_schema['properties']['browser_tests']['items']['properties']['steps']['items']={
            'type':'OBJECT','properties':{
                'action':deepcopy(STEP_SCHEMA['properties']['action']),
                'locator_type':{'type':'STRING','enum':['label','placeholder','text','testid','page',*['role:'+role for role in sorted(ROLES)]]},
                'locator':{'type':'STRING'},'value':{'type':'STRING'}},
            'required':['action','locator_type','locator','value']}
    try:
        instructions=INSTRUCTIONS
        if kind=='flask':
            instructions=instructions.replace('Allowed files: html/css/js/jsx/cjs/mjs/json/md/svg.', 'Allowed files: py/html/css/js/md/svg.')
            instructions+='\nFLASK RUNTIME: Supply a Python entrypoint (normally app.py) defining a global Flask app, plus every referenced templates/ and static/ file. Flask 3.1.3 is installed. Use local assets only, no database or extra pip dependencies unless the task supports them. No environment/system imports. Put app.run only under the main guard; the host starts a loopback WSGI server with debugging/reloading disabled. Use real GET/POST routes and server-side form validation, not a static HTML substitute. Select app.py and relevant template/JS logic for source_capture_files. Browser tests must exercise actual server-backed success and invalid states. Include README instructions: python -m pip install Flask==3.1.3, then flask --app app run.'
        raw=await generation_service.generate_json(instructions,prompt,provider_schema,on_retry=on_retry)
    except GenerationError as error:
        raw=getattr(error,'draft',None)
        if not isinstance(raw,dict): raise
    try:
        data=canonical_web_data(raw,schema,requirements)
    except (ValueError, KeyError, TypeError) as error:
        failure=GenerationError(str(error))
        if isinstance(raw,dict): failure.project_data=raw
        raise failure from None
    try:
        validate(data,strict_json_schema(schema))
    except ValidationError as error:
        path='.'.join(str(p) for p in error.absolute_path) or 'root'
        detail=error.validator
        if error.validator=='required' and isinstance(error.instance,dict):
            detail='missing required fields '+', '.join(name for name in error.validator_value if name not in error.instance)
        failure=GenerationError(f'Invalid web project response at {path}: {detail}. Keep complete files and browser tests in the required schema.')
        failure.project_data=data
        raise failure from None
    data.setdefault('language',language)
    data.setdefault('project_type',kind)
    data.setdefault('server_entrypoint','')
    data.setdefault('api_tests',[])
    data.setdefault('browser_tests',[])
    try:
        project = validate_project(data)
        from .source_evidence import source_capture_plan
        source_capture_plan(project['project_files'],'',project['entrypoint'],language,data.get('source_capture_files'))
        if data.get('language') != language: raise ValueError("Generated project language differs from the requested language.")
        if language in {'html', 'react'} and project['project_type'] != language:
            raise ValueError('Project type does not match the requested frontend runtime.')
        if language=='python' and project['project_type']!='flask':raise ValueError('A Flask assignment needs a Flask project.')
        if kind == 'fullstack' and project['project_type'] != 'fullstack':
            raise ValueError('React + Node requirements need a fullstack project with separate entrypoints.')
        from .browser_scenarios import normalize_v2, validate_coverage_plan
        plans = [{**test, 'version':test.get('version',2)} for test in data.get('browser_tests',[]) if isinstance(test,dict)]
        if len(plans) != len(data.get('browser_tests', [])): raise ValueError('Browser scenarios must be objects.')
        source_ids={r['id'] for r in requirements if r['kind']=='source'}
        plans=[test for test in plans if not (test.get('requirement_ids') and set(test['requirement_ids']).issubset(source_ids))]
        tests = normalize_v2(plans) if project['project_type'] != 'node' else []
        if project['project_type'] != 'node': validate_coverage_plan(requirements, tests)
        project.update(browser_tests=tests, api_tests=api_tests(data), requirements=requirements,
                       source_capture_files=data.get('source_capture_files',[]),
                       source_checks=source_checks(requirements, project),
                       interaction_is_required=bool(set(behavior_ids)-{'responsive'}) or bool(re.search(r'\b(button|click|submit|interactive|calculator)\b',question,re.I)))
        missing = [k for k, v in project['source_checks'].items() if not v]
        if missing: raise ValueError('Missing source requirements: ' + ', '.join(missing))
        if project['project_type'] in {'node', 'fullstack'} and not project['api_tests']:
            raise ValueError('Node server projects require API request tests.')
        if project['project_type'] in {'node', 'fullstack'} and any(r['id']=='validation' for r in requirements):
            requests = project['api_tests']
            if not (any(t['method']=='GET' and t['expected_status']==200 for t in requests)
                    and any(t['method']=='POST' and 200<=t['expected_status']<300 for t in requests)
                    and any(t['method']=='POST' and t['expected_status'] in {400,422} for t in requests)):
                raise ValueError('Server validation requires GET, successful POST, and invalid POST API tests.')
    except (ValueError, KeyError, TypeError) as error:
        failure = ValueError(str(error))
        failure.project_data = data
        raise failure from None
    return data, project

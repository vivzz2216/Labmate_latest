"""Versioned, declarative browser scenarios. No generated scripts are evaluated."""
import asyncio
import json
from urllib.parse import urlsplit

from playwright.async_api import expect

ROLES = set('button textbox spinbutton checkbox radio combobox link heading list listitem main navigation banner contentinfo status alert dialog region article img option tab form switch'.split())
PAGE_ACTIONS = {'reload', 'goto', 'reset_storage', 'assert_http', 'assert_url', 'assert_no_overflow', 'screenshot'}
ACTIONS = PAGE_ACTIONS | {'fill', 'click', 'click_confirm', 'select', 'assert_visible', 'assert_absent', 'assert_count', 'assert_value', 'assert_attribute', 'assert_order', 'assert_checked'}
ATTRIBUTES = {'class', 'data-theme', 'aria-expanded', 'aria-current', 'aria-pressed', 'href', 'alt'}


def local_path(value):
    return (isinstance(value, str) and value.startswith('/') and not value.startswith('//')
            and '\\' not in value and len(value) <= 500 and not any(ord(c) < 32 for c in value)
            and not urlsplit(value).netloc and not urlsplit(value).scheme)


def normalize_v2(tests):
    if not isinstance(tests, list) or not 1 <= len(tests) <= 12:
        raise ValueError('Browser v2 requires 1–12 declarative scenarios.')
    if sum(len(t.get('steps', [])) for t in tests if isinstance(t, dict)) > 140:
        raise ValueError('Browser plans are limited to 140 total steps.')
    normalized = []
    for test in tests:
        if not isinstance(test, dict) or set(test) != {'version', 'name', 'requirement_ids', 'steps', 'viewport'} or test['version'] != 2:
            raise ValueError('Invalid browser v2 scenario structure.')
        if not isinstance(test['name'], str) or not 1 <= len(test['name']) <= 120:
            raise ValueError('Browser scenarios need a short name.')
        ids = test['requirement_ids']
        if not isinstance(ids, list) or len(ids) > 30 or any(not isinstance(i, str) or len(i) > 60 for i in ids):
            raise ValueError('Invalid requirement IDs.')
        vp = test['viewport']
        if not isinstance(vp, dict) or set(vp) != {'width', 'height'} or any(type(vp[k]) is not int or not 240 <= vp[k] <= 1920 for k in vp):
            raise ValueError('Invalid browser viewport.')
        steps = test['steps']
        if not isinstance(steps, list) or not 1 <= len(steps) <= 24:
            raise ValueError('Scenarios require 1–24 steps.')
        assertions = 0
        canonical = []
        for step_index, original in enumerate(steps, 1):
            s = dict(original) if isinstance(original, dict) else original
            if not isinstance(s, dict) or set(s) != {'action', 'locator_type', 'locator', 'role', 'value'} or any(not isinstance(v, str) for v in s.values()):
                raise ValueError('Invalid declarative browser step.')
            action, kind, value = s['action'], s['locator_type'], s['value']
            if kind in {'label','placeholder','text','testid'}:
                s['role'] = ''  # These locator kinds never use an advisory role.
            # A name in the value slot is unambiguous for a name-only operation.
            # Canonicalize presentation, never infer a missing selector or action.
            if action in {'click','assert_visible','assert_absent'} and kind in {'role','label','placeholder','text','testid'} and not s['locator'] and value:
                s['locator'], s['value'], value = value, '', ''
            if action not in ACTIONS or kind not in {'role', 'label', 'placeholder', 'text', 'testid', 'page'}:
                raise ValueError('Unsupported browser action or locator.')
            if len(s['locator']) > 200 or len(value) > 2000 or len(s['role']) > 40:
                raise ValueError('Browser step exceeds string limits.')
            if action in PAGE_ACTIONS:
                if kind != 'page' or s['locator'] or s['role']:
                    raise ValueError('Page operations require an empty page locator.')
            elif kind == 'page' or not s['locator'].strip():
                raise ValueError(f"Scenario {test['name']}, step {step_index} ({action}): use a nonempty role/label/placeholder/text/testid locator, not an empty or page locator. For assert_visible/assert_absent put expected visible text in locator with locator_type=text and value empty.")
            if kind == 'role' and s['role'] not in ROLES or kind != 'role' and s['role']:
                raise ValueError('Role is required only for accessible role locators.')
            if action in {'click', 'reload', 'reset_storage', 'assert_visible', 'assert_absent', 'assert_no_overflow', 'screenshot'} and value:
                raise ValueError('This browser operation does not accept a value.')
            if action in {'goto','assert_url'} and not local_path(value):
                raise ValueError('Browser navigation must stay on the local origin.')
            if action=='assert_checked' and value not in {'true','false'}: raise ValueError('Checked assertions require true or false.')
            if action=='click_confirm' and not value.strip(): raise ValueError('Confirmed clicks require the exact expected confirmation message.')
            if action == 'assert_count' and (not value.isdigit() or not 0 <= int(value) <= 100):
                raise ValueError('Count assertions require an integer from 0 to 100.')
            if action == 'assert_attribute':
                spec = json.loads(value)
                if not isinstance(spec, dict) or set(spec) != {'name', 'equals'} or spec['name'] not in ATTRIBUTES or not isinstance(spec['equals'], str):
                    raise ValueError('Unsupported attribute assertion.')
            if action == 'assert_order':
                spec = json.loads(value)
                if not isinstance(spec, list) or not 2 <= len(spec) <= 20 or any(not isinstance(x, str) or not x for x in spec):
                    raise ValueError('Order assertions require 2–20 nonempty expected fragments.')
            if action == 'assert_http':
                spec = json.loads(value)
                if not isinstance(spec, dict) or set(spec) != {'method', 'path', 'status'} or not local_path(spec['path']) or spec['method'] not in {'GET', 'POST', 'PUT', 'PATCH', 'DELETE'} or type(spec['status']) is not int or not 200 <= spec['status'] <= 599:
                    raise ValueError('Invalid HTTP observation assertion.')
            assertions += action.startswith('assert_')
            canonical.append(s)
        if not assertions:
            raise ValueError('Every browser scenario requires a visible or HTTP assertion.')
        normalized.append({**test, 'steps': canonical})
    return normalized


def validate_coverage_plan(requirements, tests):
    """Require meaningful operations, not just a model's coverage labels."""
    required = {r['id'] for r in requirements if r['kind'] == 'behavior'}
    known = {r['id'] for r in requirements}
    for test in tests:
        if set(test['requirement_ids']) - known:
            raise ValueError('Browser plan claims unknown requirement IDs.')
    missing = []
    for feature in required:
        matching = [t for t in tests if feature in t['requirement_ids']]
        steps = [s for t in matching for s in t['steps']]
        ops = {s['action'] for s in steps}
        if 'click_confirm' in ops: ops.add('click')
        ok = bool(matching) and any(x.startswith('assert_') for x in ops)
        expectations = {
            'edit': {'fill', 'click', 'assert_absent', 'assert_visible'},
            'delete': {'click', 'assert_absent'}, 'persistence': {'reload', 'assert_visible'},
            'sort': {'assert_order'}, 'search': {'fill'},
            'theme': {'click', 'assert_attribute'}, 'toggle': {'click', 'assert_absent'},
            'routes': {'goto', 'assert_visible'}, 'dynamic_route': {'goto', 'assert_visible'},
            'not_found': {'goto', 'assert_visible'}, 'fetch': {'assert_http'}, 'api': {'assert_http'},
            'loading': {'assert_visible', 'screenshot'}, 'error_recovery': {'goto', 'click', 'assert_http'},
            'validation': {'click', 'assert_visible'}, 'success_state': {'click', 'assert_visible'},
            'create': {'fill', 'click', 'assert_visible'}, 'complete': {'click'},
            'count': {'assert_visible'}, 'empty': {'assert_visible'},
        }
        ok = ok and expectations.get(feature, set()).issubset(ops)
        if feature in {'filter', 'navigation'}:
            ok = ok and bool(ops & {'fill', 'click', 'select', 'goto'})
        if feature=='sort': ok=ok and bool(ops & {'click','select'})
        if feature == 'navigation':
            ok = ok and 'click' in ops
        if feature == 'catalogue_items':
            ok = ok and any(s['action']=='assert_count' and s['value'].isdigit() and int(s['value']) >= 8 for s in steps)
        if feature in {'filter', 'search'}:
            ok = ok and bool(ops & {'assert_count', 'assert_absent'})
        if feature == 'persistence':
            ok = ok and 'fill' in ops and 'click' in ops
        if feature == 'edit':
            controls = ' '.join(s['locator'].lower() for s in steps if s['action'] == 'click')
            ok = ok and 'edit' in controls and any(x in controls for x in ('save', 'update'))
        if feature == 'responsive':
            sizes = [t['viewport']['width'] for t in matching if any(s['action'] == 'assert_no_overflow' for s in t['steps'])]
            ok = bool(sizes) and min(sizes) <= 480 and max(sizes) >= 1024
        if not ok: missing.append(feature)
    if missing:
        detail = ' Responsive coverage needs assert_no_overflow in BOTH a mobile (<=480px) and desktop (>=1024px) scenario tagged responsive.' if 'responsive' in missing else ''
        raise ValueError('Missing adequate browser requirement coverage: ' + ', '.join(sorted(missing)) + '.' + detail)
    return sorted(required)


def locator_for(page, step):
    kind, value = step['locator_type'], step['locator']
    if kind == 'role': return page.get_by_role(step['role'], name=value, exact=True)
    if kind == 'label': return page.get_by_label(value, exact=True)
    if kind == 'placeholder': return page.get_by_placeholder(value, exact=True)
    if kind == 'testid': return page.get_by_test_id(value)
    return page.get_by_text(value, exact=True).and_(page.locator(':visible:not(option)'))


async def run_v2(page, test, result, origin, observations, capture, reset_http=lambda:None):
    result['assertions'] = []
    baseline = {}
    async def assertion_state(s):
        if s['action']=='assert_url':
            url=urlsplit(page.url)
            return url.path+('?' + url.query if url.query else '')+('#'+url.fragment if url.fragment else '')
        if s['action'] in PAGE_ACTIONS: return None
        loc = locator_for(page, s)
        count = await loc.count()
        if s['action'] in {'assert_visible', 'assert_absent'}: return bool(count and await loc.first.is_visible())
        if s['action'] == 'assert_count': return count
        if s['action'] == 'assert_attribute': return await loc.get_attribute(json.loads(s['value'])['name']) if count == 1 else None
        if s['action'] == 'assert_value':
            return await loc.input_value() if count==1 and await loc.evaluate('element=>["INPUT","SELECT","TEXTAREA"].includes(element.tagName)') else None
        if s['action']=='assert_checked':
            return await loc.is_checked() if count==1 and await loc.evaluate('element=>element.matches("input[type=checkbox],input[type=radio]")') else None
        if s['action'] == 'assert_order': return await loc.all_text_contents()
    def assertion_key(s): return json.dumps(s, sort_keys=True)
    for index, step in enumerate(test['steps'], 1):
        result['failed_step'] = index
        op, value = step['action'], step['value']
        loc = None if op in PAGE_ACTIONS else locator_for(page, step)
        if op in {'fill', 'click', 'click_confirm', 'select', 'reload', 'goto'}:
            if loc is not None: await loc.wait_for(state='visible', timeout=2500)
            for assertion in test['steps']:
                if assertion['action'].startswith('assert_') and assertion['action'] not in PAGE_ACTIONS:
                    baseline[assertion_key(assertion)] = await assertion_state(assertion)
            result.setdefault('mutations', []).append({'step': index, 'action': op, 'locator': step['locator'], 'value': value})
        if op == 'fill': await loc.fill(value, timeout=2500)
        elif op == 'click': await loc.click(timeout=2500)
        elif op == 'click_confirm':
            click_task=None
            page._labmate_confirm_pending=True
            try:
                async with page.expect_event('dialog',timeout=2500) as pending:
                    click_task=asyncio.create_task(loc.click(timeout=2500))
                dialog=await pending.value
                observed={'type':dialog.type,'message':dialog.message}
                result.setdefault('dialogs',[]).append(observed)
                if dialog.type!='confirm' or dialog.message!=value:
                    await dialog.dismiss()
                    raise ValueError(f'Expected confirmation {value!r}, observed {observed!r}.')
                await dialog.accept()
                await click_task
            finally:
                page._labmate_confirm_pending=False
                if click_task is not None:
                    if not click_task.done(): click_task.cancel()
                    await asyncio.gather(click_task,return_exceptions=True)
        elif op == 'select':
            options = await loc.locator('option').evaluate_all('(items)=>items.map(item=>({label:item.label,value:item.value}))')
            matches = [item for item in options if item['label'] == value or item['value'] == value]
            if len(matches) != 1: raise ValueError('Select needs exactly one option with this exact label or value.')
            await loc.select_option(value=matches[0]['value'], timeout=2500)
        elif op == 'reload':
            reset_http()
            await page.reload(wait_until='domcontentloaded', timeout=5000)
        elif op == 'goto':
            reset_http()
            await page.goto(origin + value, wait_until='domcontentloaded', timeout=5000)
        elif op == 'reset_storage':
            await page.evaluate('() => { localStorage.clear(); sessionStorage.clear(); }')
            reset_http()
            await page.reload(wait_until='domcontentloaded', timeout=5000)
        elif op == 'screenshot': await capture(index)
        elif op == 'assert_visible':
            await expect(loc.first).to_be_visible(timeout=3000)
            visible = await loc.first.evaluate('''element => { while(element) { const s=getComputedStyle(element); if(s.visibility==='hidden'||s.visibility==='collapse'||s.display==='none'||Number(s.opacity)===0)return false; element=element.parentElement; } return true; }''')
            if not visible: raise ValueError('Expected content is visually hidden or transparent.')
        elif op == 'assert_absent': await expect(loc).to_be_hidden(timeout=3000)
        elif op == 'assert_count': await expect(loc).to_have_count(int(value), timeout=3000)
        elif op == 'assert_value': await expect(loc).to_have_value(value, timeout=3000)
        elif op == 'assert_checked':
            if value=='true': await expect(loc).to_be_checked(timeout=3000)
            else: await expect(loc).not_to_be_checked(timeout=3000)
        elif op == 'assert_url':
            deadline=asyncio.get_running_loop().time()+3
            while await assertion_state(step)!=value:
                if asyncio.get_running_loop().time()>=deadline: raise ValueError(f'Expected URL path {value!r}, observed {await assertion_state(step)!r}.')
                await asyncio.sleep(.05)
        elif op == 'assert_attribute':
            spec = json.loads(value)
            await expect(loc).to_have_attribute(spec['name'], spec['equals'], timeout=3000)
        elif op == 'assert_order':
            expected = json.loads(value)
            deadline = asyncio.get_running_loop().time() + 3
            while True:
                actual = await loc.all_text_contents()
                if len(actual) == len(expected) and all(wanted in observed for wanted, observed in zip(expected, actual)): break
                if asyncio.get_running_loop().time() >= deadline:
                    raise ValueError(f'Wrong item order/count: expected {expected!r}, observed {actual!r}.')
                await asyncio.sleep(.1)
        elif op == 'assert_http':
            spec = json.loads(value)
            deadline = asyncio.get_running_loop().time() + 4
            while not any(all(x[k] == spec[k] for k in spec) for x in observations):
                if asyncio.get_running_loop().time() >= deadline:
                    raise ValueError(f'Required browser HTTP response not observed: {spec!r}.')
                await asyncio.sleep(.05)
        elif op == 'assert_no_overflow':
            if await page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'):
                raise ValueError('Page has horizontal overflow at this viewport.')
        result['executed_steps'] = index
        if op.startswith('assert_'):
            current = await assertion_state(step)
            result['assertions'].append({'step': index, 'action': op, 'expected': value or step['locator'], 'status': 'passed', 'observed': current, 'changed': assertion_key(step) in baseline and current != baseline[assertion_key(step)]})
    result.pop('failed_step', None)
    result['status'] = 'passed'


def validate_run_coverage(requirements, verification):
    failures = []
    for r in requirements:
        feature = r['id']
        tests = [t for t in verification.get('tests', []) if t.get('status') == 'passed' and feature in t.get('requirement_ids', [])]
        assertions = [a for t in tests for a in t.get('assertions', [])]
        required_changes = {
            'create': {'assert_visible'}, 'edit': {'assert_visible'}, 'delete': {'assert_absent'},
            'success_state': {'assert_visible'}, 'theme': {'assert_attribute'}, 'toggle': {'assert_absent'},
            'search': {'assert_count', 'assert_absent'}, 'filter': {'assert_count', 'assert_absent'},
            'sort': {'assert_order'}, 'calculation': {'assert_visible'},
        }
        if feature in required_changes and not any(a.get('changed') and a['action'] in required_changes[feature] for a in assertions):
            failures.append(feature + ': no asserted state change after an action')
        if feature == 'persistence' and not any(
            any(a['action']=='assert_visible' and a.get('changed') and a['step'] < m['step'] for a in t.get('assertions', []))
            and any(a['action']=='assert_visible' and a['step'] > m['step'] for a in t.get('assertions', []))
            for t in tests for m in t.get('mutations', []) if m['action']=='reload'):
            failures.append('persistence: saved content was not asserted before and after reload')
    if failures: raise ValueError('Requirement verification failed: ' + '; '.join(failures))

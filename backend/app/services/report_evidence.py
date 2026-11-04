"""Keep intentional state captures; avoid redundant automatic final frames."""
import re
from pathlib import Path


def browser_captures(paths,verification):
    tests=(verification or {}).get('tests',[])
    chosen=[]
    explicit={}
    for path in paths:
        match=re.fullmatch(r'test_(\d+)_step_(\d+)\.png',Path(path).name)
        if match:explicit.setdefault(int(match[1]),[]).append(int(match[2]))
    for path in paths:
        match=re.fullmatch(r'test_(\d+)(?:_step_(\d+))?\.png',Path(path).name)
        test=tests[int(match[1])-1] if match and 0<int(match[1])<=len(tests) else {}
        if match and not match[2] and int(match[1]) in explicit:
            last=max(explicit[int(match[1])]);steps=test.get('steps',[])
            if (test.get('status')=='passed' and 0<last<=len(steps)
                    and not any(s.get('action') in {'fill','click','click_confirm','select','goto','reload','reset_storage'} for s in steps[last:])):
                continue
        caption='Actual browser capture'
        if test.get('name'):caption+=' — '+test['name']
        chosen.append({'path':path,'kind':'browser','caption':caption})
    return chosen


async def frame_browser_captures(paths, verification, *, browser_theme, job_id, filename):
    """Presentation only: never promote failed checks or replace captured page content."""
    from .screenshot_service import screenshot_service
    captures = {item['path']:item for item in (verification or {}).get('captures', []) if item.get('path')}
    selected, errors = [], []
    for item in browser_captures(paths, verification):
        metadata = captures.get(item['path'], {})
        try:
            ok, framed, _, _ = await screenshot_service.generate_browser_preview_from_image(
                item['path'], job_id, filename, browser_theme=browser_theme,
                page_url=metadata.get('url', 'about:blank'), page_title=metadata.get('title', ''))
        except Exception:
            ok = False
        if not ok:
            errors.append('Required browser frame could not be captured.')
            continue
        name = 'Microsoft Edge' if browser_theme == 'edge' else 'Google Chrome'
        selected.append({**item, 'path':framed, 'caption':item['caption'] + f' ({name}-style Windows frame)'})
    if verification is not None:
        verification['presentation'] = {'browser_theme':browser_theme, 'frame':'rendered_windows', 'content':'captured_page_pixels'}
    return selected, errors

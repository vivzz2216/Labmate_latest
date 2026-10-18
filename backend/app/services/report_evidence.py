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

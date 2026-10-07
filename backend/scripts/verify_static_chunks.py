import urllib.request
import re

url = 'http://localhost:3000/'
try:
    with urllib.request.urlopen(url, timeout=5) as resp:
        html = resp.read().decode('utf-8')
        print('HTTP Status:', resp.status)
        print('Has Video Reel Placeholder:', 'Video Reel Placeholder' in html)
        print('Has Live Terminal Stream:', 'Live Terminal Stream' in html)
        print('No missing video tags:', '<video' not in html)

        scripts = re.findall(r'src="(/_next/static/[^"]+)"', html)
        print(f'Testing {len(scripts)} static script files...')
        all_ok = True
        for s in scripts:
            s_url = f'http://localhost:3000{s}'
            with urllib.request.urlopen(s_url, timeout=5) as s_resp:
                if s_resp.status != 200:
                    print(f'FAIL {s}: {s_resp.status}')
                    all_ok = False
        if all_ok:
            print('SUCCESS: ALL static chunks loaded with 200 OK! Zero 404s!')
except Exception as e:
    print('Error:', e)

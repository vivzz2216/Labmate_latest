"""Audit-owned canary and loopback probe. Never reads user/service files."""
import asyncio
import json
import tempfile
import threading
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.services.runtime_engine import runtime_engine


class AuditHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b'audit-loopback-response')
    def log_message(self, *args): pass


async def main():
    output = Path('audit_artifacts/security')
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='labmate-owned-canary-') as folder:
        owned = Path(folder)
        canary = owned/'sibling-canary.txt'
        canary.write_text('audit-owned-canary')
        settings.REACT_TEMP_DIR = str(owned/'runtime')
        settings.SCREENSHOT_DIR = str(owned/'screenshots')
        read = await runtime_engine.execute("const fs=require('fs');console.log(fs.readFileSync(" + json.dumps(str(canary)) + ",'utf8'));", 'node')
        server = HTTPServer(('127.0.0.1',0), AuditHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            network = await runtime_engine.execute("require('http').get('http://127.0.0.1:" + str(server.server_port) +
                "/',r=>{let s='';r.on('data',d=>s+=d);r.on('end',()=>console.log(s));});", 'node')
        finally:
            await asyncio.to_thread(server.shutdown); server.server_close(); thread.join(timeout=2)
        record = {'sibling_canary_read': {'accessible': read.success and 'audit-owned-canary' in read.output,
                  'scope': 'Audit-owned temporary canary only; no user or service files accessed.'},
                  'process_network_access': {'allowed': network.success and 'audit-loopback-response' in network.output,
                  'scope': 'Audit-owned local HTTP endpoint only'},
                  'private_workspaces_cleaned': not any((owned/'runtime').glob('labmate_*'))}
    (output/'security-probes.json').write_text(json.dumps(record, indent=2))
    print(json.dumps(record, indent=2))


if __name__ == '__main__': asyncio.run(main())

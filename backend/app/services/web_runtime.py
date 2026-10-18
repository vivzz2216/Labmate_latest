"""Separate local frontend/API servers, controlled fixtures and guaranteed cleanup."""
import asyncio
import json
import re
import socket
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

import httpx

from ..config import settings

BROWSER_CSP="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'"


class FixtureHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

    def end_headers(self):
        self.send_header('Content-Security-Policy',BROWSER_CSP)
        super().end_headers()

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/__labmate__/users':
            state = parse_qs(url.query).get('state', [''])[0]
            if state == 'slow': time.sleep(2)
            status = 503 if state == 'error' else 200
            body = json.dumps({'error': 'Controlled service failure'} if status == 503 else [
                {'id': 1, 'name': 'Maya Patel', 'email': 'maya@example.test'},
                {'id': 2, 'name': 'Arun Shah', 'email': 'arun@example.test'},
                {'id': 3, 'name': 'Leena Rao', 'email': 'leena@example.test'},
            ]).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            try: self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError): pass
        else:
            super().do_GET()


def reserve_port():
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    return sock, sock.getsockname()[1]


async def capture_project(engine, directory, config):
    from .runtime_engine import RuntimeResult, write_project_files, run_process, start_process, collect_output, kill_process_tree
    from .web_project import validate_project
    # Validate again at the execution boundary, including callers outside generation.
    validate_project({'files': [{'path': n, 'content': c} for n, c in config['project_files'].items()],
                      **{k: config.get(k, '') for k in ('entrypoint', 'project_type', 'server_entrypoint')}})
    write_project_files(directory, config['project_files'])
    kind = config['project_type']
    processes, streams = [], []
    reservations = []
    fixture = ThreadingHTTPServer(('127.0.0.1', 0), partial(FixtureHandler, directory=str(directory)))
    fixture.daemon_threads = True
    fixture_task = asyncio.create_task(asyncio.to_thread(fixture.serve_forever, poll_interval=.05))

    async def launch(command, port):
        process = await start_process(command, directory, {'PORT': str(port), 'NODE_ENV': 'development', 'NODE_OPTIONS': '--max-old-space-size=256'}, resource_limits={'max_memory_bytes': 0})
        processes.append(process)
        process.stdin.close()
        streams.extend([asyncio.create_task(collect_output(process.stdout, process)), asyncio.create_task(collect_output(process.stderr, process))])
        async with httpx.AsyncClient(timeout=1, trust_env=False) as client:
            for _ in range(100):
                if process.returncode is not None: raise ValueError('Web server exited before becoming ready.')
                try:
                    if (await client.get(f'http://127.0.0.1:{port}/')).status_code < 500: return
                except httpx.TransportError: pass
                await asyncio.sleep(.15)
        raise ValueError('Web server did not start within 15 seconds.')

    result = None
    try:
        if kind == 'html':
            # Default documents start at / just like Vite and the declared
            # scenario contract, so fragment/navigation assertions are portable.
            url = f'http://127.0.0.1:{fixture.server_port}/' + ('' if config['entrypoint']=='index.html' else config['entrypoint'])
        else:
            error = await engine._install_packages('react' if kind in {'react', 'fullstack'} else 'node', directory)
            if error: return RuntimeResult(False, error=error, exit_code=127)
            server_port = None
            if kind in {'node', 'fullstack'}:
                entry = config['server_entrypoint'] if kind == 'fullstack' else config['entrypoint']
                source = directory / entry
                # CommonJS .js and explicit .mjs are supported; no JSX transpilation on the API.
                checked = await run_process([settings.NODE_COMMAND, '--check', source], directory, timeout=10, resource_limits={'max_memory_bytes': 0})
                if not checked.success: return checked
                reservation, server_port = reserve_port()
                reservations.append(reservation)
                preload = directory / '_labmate_bind.cjs'
                preload.write_text("const net=require('node:net');const original=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){const port=Number(process.env.PORT);if(typeof args[0]==='object'){args[0]={...args[0],port,host:'127.0.0.1'};}else{args[0]=port;if(typeof args[1]==='string')args[1]='127.0.0.1';else args.splice(1,0,'127.0.0.1');}return original.apply(this,args);};", encoding='utf-8')
                reservation.close()
                backend_command = [settings.NODE_COMMAND, '--require', preload, source]
                await launch(backend_command, server_port)
            if kind == 'node':
                result = await engine._capture_api(f'http://127.0.0.1:{server_port}', config.get('api_tests'))
                return result
            proxy = {'/__labmate__': {'target': f'http://127.0.0.1:{fixture.server_port}'}}
            if server_port: proxy['/api'] = {'target': f'http://127.0.0.1:{server_port}'}
            (directory / 'vite.config.mjs').write_text('export default ' + json.dumps({'esbuild': {'jsx': 'automatic'}, 'server': {'hmr': False, 'proxy': proxy, 'headers':{'Content-Security-Policy':BROWSER_CSP}}}), encoding='utf-8')
            reservation, frontend_port = reserve_port()
            reservations.append(reservation)
            reservation.close()
            await launch([settings.NODE_COMMAND, directory / 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', str(frontend_port), '--strictPort'], frontend_port)
            url = f'http://127.0.0.1:{frontend_port}'
        result = await engine._capture_html(None, config.get('browser_tests'), config.get('interaction_is_required',True), page_url=url)
        result.stages = {'render': 'passed' if result.success else 'failed', 'browser': (result.verification or {}).get('status', 'failed')}
        if kind == 'fullstack':
            # Browser CRUD and API scenarios must not contaminate each other's
            # in-memory initial state. No application reset endpoint is needed.
            await kill_process_tree(processes[0])
            await launch(backend_command, server_port)
            api = await engine._capture_api(f'http://127.0.0.1:{server_port}', config.get('api_tests'))
            result.output += '\n\n' + api.output
            result.error = '\n'.join(x for x in (result.error, api.error) if x)
            result.success = result.success and api.success
            result.exit_code = 0 if result.success else 1
            result.verification.update(kind='fullstack', api_verification=api.verification, status='passed' if result.success else 'failed')
            result.stages['http'] = 'passed' if api.success else 'failed'
        return result
    except Exception as error:
        result = RuntimeResult(False, error=str(error)[:2000], exit_code=1)
        return result
    finally:
        for process in processes: await kill_process_tree(process)
        logs = await asyncio.gather(*streams, return_exceptions=True)
        if result is not None and not result.success:
            details = '\n'.join(item[0][-2500:] for item in logs if isinstance(item, tuple) and item[0])
            details=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',details)
            result.error = (result.error + '\n' + details).strip()
        for reservation in reservations: reservation.close()
        await asyncio.to_thread(fixture.shutdown)
        fixture.server_close()
        await fixture_task

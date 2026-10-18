"""Real local HTTP upload -> model -> runner -> Word download audit. No model mocks."""
import io
import json
import secrets
import time
from pathlib import Path
from zipfile import ZipFile

import httpx
from docx import Document
from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / 'audit_artifacts'


def main():
    results = []
    output = ROOT / 'end-to-end'
    output.mkdir(exist_ok=True)
    with httpx.Client(base_url='http://127.0.0.1:3016', timeout=60, trust_env=False) as client:
        health = client.get('/health/ready')
        health.raise_for_status()
        account = client.post('/api/basic-auth/signup', json={'email': f'audit-{secrets.token_hex(5)}@example.com',
            'name': 'Audit Student', 'password': 'Audit1!' + secrets.token_hex(16)})
        account.raise_for_status()
        auth = account.json()
        client.headers.update({'Authorization': 'Bearer ' + auth['access_token'], 'X-CSRF-Token': auth['csrf_token']})
        for name in ('manual_mixed.pdf', 'manual_gui.pdf', 'malformed.pdf', 'manual_scanned.pdf'):
            started = time.perf_counter()
            path = ROOT / 'manuals' / name
            response = client.post('/api/upload', files={'file': (name, path.read_bytes(), 'application/pdf')})
            record = {'manual': name, 'upload_status': response.status_code, 'model_generation': 'real configured provider'}
            if response.status_code != 200:
                record['upload_error'] = response.text
            else:
                upload_id = response.json()['id']
                response = client.post(f'/api/workflows/{upload_id}/extract')
                response.raise_for_status()
                state = poll(client, upload_id, {'ready', 'failed', 'paused'})
                record.update(extraction_seconds=round(time.perf_counter()-started, 4), questions=state['questions'], extraction_status=state['status'])
                if state['status'] == 'ready':
                    processing = time.perf_counter()
                    response = client.post(f'/api/workflows/{upload_id}/process', json={'questions': state['questions'],
                        'language': 'auto', 'instructions': '', 'output_name': path.stem + '_audit', 'screenshot_style': 'style_1'})
                    response.raise_for_status()
                    state = poll(client, upload_id, {'completed', 'failed', 'paused'})
                    record.update(processing_seconds=round(time.perf_counter()-processing,4), status=state['status'],
                                  error=state.get('error'), results=state['results'], logs=state['logs'])
                    if state.get('report'):
                        download = client.get(state['report']['download_url'])
                        download.raise_for_status()
                        target = output / state['report']['filename']
                        target.write_bytes(download.content)
                        document = Document(io.BytesIO(download.content))
                        with ZipFile(io.BytesIO(download.content)) as package:
                            images = [n for n in package.namelist() if n.startswith('word/media/')]
                            for image in images:
                                with Image.open(io.BytesIO(package.read(image))) as pixels: pixels.verify()
                        valid_ratios = all(abs(shape.width/shape.height - Image.open(io.BytesIO(document.part.related_parts[
                            shape._inline.graphic.graphicData.pic.blipFill.blip.embed].blob)).width / Image.open(io.BytesIO(document.part.related_parts[
                            shape._inline.graphic.graphicData.pic.blipFill.blip.embed].blob)).height) < .01 for shape in document.inline_shapes)
                        record.update(download_status=download.status_code, report=str(target), report_bytes=len(download.content),
                                      embedded_images=len(images), aspect_ratios_preserved=valid_ratios,
                                      report_text='\n'.join(p.text for p in document.paragraphs))
                        preview = client.get(f'/api/workflows/{upload_id}/preview')
                        record['preview_status'] = preview.status_code
                else:
                    record['error'] = state.get('error')
            record['total_seconds'] = round(time.perf_counter()-started, 4)
            results.append(record)
            (output / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
            print(name, record.get('status', record.get('extraction_status', record['upload_status'])),
                  record.get('download_status'), record['total_seconds'], flush=True)


def poll(client, upload_id, terminal):
    deadline = time.monotonic() + 360
    last = None
    while time.monotonic() < deadline:
        response = client.get(f'/api/workflows/{upload_id}')
        response.raise_for_status()
        last = response.json()
        if last['status'] in terminal: return last
        time.sleep(1)
    raise TimeoutError(f'Workflow {upload_id} exceeded audit deadline at {last["stage"]}')


if __name__ == '__main__': main()

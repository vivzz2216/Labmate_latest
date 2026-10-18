"""Local audit launcher: SQLite + emulated Redis, loopback only, no Docker.

Use --config PATH to supply existing model credentials; never writes them to disk.
State/logs go to ignored audit_artifacts/local-app. This is not a production launcher.
"""
import argparse
import json
import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', action='append', default=[])
    parser.add_argument('--component', choices=['backend', 'frontend', 'redis'])
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    state = root / 'backend/audit_artifacts/local-app'
    state.mkdir(parents=True, exist_ok=True)
    if args.component == 'redis':
        from fakeredis import TcpFakeServer
        TcpFakeServer(('127.0.0.1', 6386)).serve_forever()
        return
    if args.component == 'backend':
        sys.path.insert(0, str(root / 'backend'))
        import uvicorn
        uvicorn.run('app.main:app', host='127.0.0.1', port=8016)
        return
    if args.component == 'frontend':
        raise SystemExit(subprocess.call([shutil.which('node'), 'node_modules/next/dist/bin/next',
                         'start', '--hostname', '127.0.0.1', '--port', '3016'], cwd=root / 'frontend'))
    env = os.environ.copy()
    from dotenv import dotenv_values
    allowed = {'FREE_LLM_FALLBACK_ORDER','OPENROUTER_API_KEY','OPENROUTER_MODEL','OPENROUTER_REASONING_EFFORT','OPENCODE_ENABLED','OPENCODE_API_KEY','OPENCODE_MODEL','FREE_LLM_REQUEST_TIMEOUT','FREE_LLM_MAX_TOKENS','LLM_PROVIDER', 'LLM_FALLBACK_PROVIDER', 'GROQ_API_KEY', 'GROQ_MODEL', 'GROQ_FALLBACK_MODEL', 'GROQ_MAX_COMPLETION_TOKENS', 'GROQ_REASONING_EFFORT', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'EXECUTION_ALLOWED_EMAILS'}
    allowed.update({'BILLING_ENABLED','BILLING_TRIAL_CREDITS','RAZORPAY_MODE','RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET','JAVA_COMMAND','JAVAC_COMMAND','C_COMPILER','CPP_COMPILER'})
    for config in args.config:
        env.update({key: value for key, value in dotenv_values(config).items() if key in allowed and value is not None and (value or key in {'LLM_FALLBACK_PROVIDER','GROQ_FALLBACK_MODEL','EXECUTION_ALLOWED_EMAILS'})})
    env.update(DATABASE_URL='sqlite:///' + (state / 'labmate.db').as_posix(), SECRET_KEY=secrets.token_hex(32),
        BETA_KEY=secrets.token_hex(32), DATA_DIR=str(state), UPLOAD_DIR=str(state/'uploads'),
        REPORT_DIR=str(state/'reports'), SCREENSHOT_DIR=str(state/'screenshots'), REACT_TEMP_DIR=str(state/'runtime'),
        REDIS_URL='redis://127.0.0.1:6386/0', REDIS_REQUIRED='true', USE_DOCKER='false',
        STORAGE_BACKEND='local', RATE_LIMIT_ENABLED='false', WORKFLOW_WORKERS='1',
        ALLOWED_ORIGINS='http://127.0.0.1:3016', FRONTEND_URL='', BACKEND_URL='http://127.0.0.1:8016')
    env.pop('RAILWAY_ENVIRONMENT_ID', None)
    pids = {}
    for component in ('redis', 'backend', 'frontend'):
        with (state / (component + '.log')).open('a', encoding='utf-8') as stream:
            process = subprocess.Popen([sys.executable, '-u', str(Path(__file__).resolve()), '--component', component],
                env=env, cwd=root, stdin=subprocess.DEVNULL, stdout=stream, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0)
        pids[component] = process.pid
    (state / 'processes.json').write_text(json.dumps(pids, indent=2))
    print('Audit app launched at http://127.0.0.1:3016; inspect audit_artifacts/local-app logs for readiness.')


if __name__ == '__main__': main()

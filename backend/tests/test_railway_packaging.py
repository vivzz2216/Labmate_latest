import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

def test_effective_root_railway_image_contains_runtime_transport():
    config=json.loads((ROOT/'railway.json').read_text())
    dockerfile=(ROOT/config['build']['dockerfilePath']).read_text()
    for required in ['backend/railway_runtime/package*.json','npm ci','backend/railway_runtime/job.py','backend/scripts/sandbox_job.py','backend/scripts/sandbox_broker.py']:
        assert required in dockerfile,required

def test_frontend_keeps_its_own_build_config():
    config=json.loads((ROOT/'frontend/railway.json').read_text())
    assert (ROOT/'frontend'/config['build']['dockerfilePath']).is_file()

"""Resolve the same resource tree in a checkout or packaged image."""
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit


def resource_file(lab, name):
    if lab not in {'google_colab','sql_workbench'}:raise ValueError('Unknown lab resource.')
    roots=[Path(os.environ['LAB_RESOURCES_DIR'])] if os.environ.get('LAB_RESOURCES_DIR') else []
    roots.extend([Path(__file__).resolve().parents[3],Path('/app/lab_resources')])
    for root in roots:
        target=root/lab/name
        if target.is_file():return target
    raise FileNotFoundError('Lab resources are not packaged: '+lab+'/'+name)


def allowed_resource(url, root):
    parsed=urlsplit(url)
    if parsed.scheme in {'data','blob','about'}:return True
    if parsed.scheme!='file':return False
    path=unquote(parsed.path)
    if os.name=='nt' and len(path)>2 and path[0]=='/' and path[2]==':':path=path[1:]
    return Path(path).resolve().is_relative_to(Path(root).resolve())

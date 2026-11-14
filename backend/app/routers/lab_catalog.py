"""Public metadata derived from the same catalog used by the frontend."""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router=APIRouter(prefix='/labs', tags=['lab-catalog'])

def load_catalog():
    packaged=Path(__file__).resolve().parents[1]/'data'/'lab_catalog.json'
    development=Path(__file__).resolve().parents[3]/'frontend'/'lib'/'lab-catalog.json'
    data=json.loads((packaged if packaged.is_file() else development).read_text(encoding='utf-8-sig'))
    keys={'slug':'slug','track':'track','title':'title','short_title':'shortTitle','tagline':'tagline',
          'description':'description','default_language':'defaultLanguage','badge':'badge',
          'accent_color':'accentColor','features':'features'}
    return [{**{dest:c[src] for dest,src in keys.items() if src in c},'experiment_count':len(c['experiments'])} for c in data]

LAB_CATALOG_DATA=load_catalog()

@router.get('')
async def list_labs():
    return LAB_CATALOG_DATA

@router.get('/{slug}')
async def get_lab_detail(slug:str):
    normalized=slug.lower().replace('_','-')
    for category in LAB_CATALOG_DATA:
        if category['slug']==normalized or category['track'].replace('_','-')==normalized:return category
    raise HTTPException(404,detail=f"Lab category '{slug}' not found.")

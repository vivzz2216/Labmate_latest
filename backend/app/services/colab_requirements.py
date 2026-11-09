"""Prevent explicitly requested notebook libraries from being silently replaced."""
import ast
import re

LIBRARIES = {
    'pyspark': r'pyspark',
    'numpy': r'numpy', 'pandas': r'pandas', 'sklearn': r'scikit[ -]?learn|sklearn',
    'scipy': r'scipy', 'matplotlib': r'matplotlib', 'seaborn': r'seaborn',
    'nltk': r'nltk', 'skfuzzy': r'scikit[ -]?fuzzy|skfuzzy', 'pgmpy': r'pgmpy',
    'torch': r'pytorch|torch', 'tensorflow': r'tensorflow', 'keras': r'keras',
}


def missing_required_libraries(question, code):
    required=set()
    for sentence in re.split(r'[\n.!?]+', question):
        if not re.search(r'\b(?:use|using|import|with|require[sd]?)\b',sentence,re.I):
            continue
        if re.search(r'\b(?:optional|may use|can use|if available)\b',sentence,re.I):
            continue
        required.update(name for name,pattern in LIBRARIES.items()
            if re.search(r'\b(?:'+pattern+r')\b',sentence,re.I)
            and not re.search(r'\b(?:not|without|instead of|rather than)\s+(?:an?\s+)?(?:'+pattern+r')\b',sentence,re.I))
    if not required:return []
    try:tree=ast.parse(code)
    except SyntaxError:return sorted(required)
    used={node.id for node in ast.walk(tree) if isinstance(node,ast.Name) and isinstance(node.ctx,ast.Load)}
    present=set()
    for node in ast.walk(tree):
        if isinstance(node,ast.Import):
            for alias in node.names:
                if (alias.asname or alias.name.split('.')[0]) in used:present.add(alias.name.split('.')[0])
        elif isinstance(node,ast.ImportFrom) and node.module:
            if any((alias.asname or alias.name) in used for alias in node.names):present.add(node.module.split('.')[0])
    return sorted(required-present)

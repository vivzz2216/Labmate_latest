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
    groups = []
    for sentence in re.split(r'[\n.!?]+', question):
        if not re.search(r'\b(?:use|using|import|with|require[sd]?|train|build|implement|fit|develop)\b', sentence, re.I):
            continue
        if re.search(r'\b(?:optional|may use|can use|if available)\b', sentence, re.I):
            continue

        found = []
        for name, pattern in LIBRARIES.items():
            for m in re.finditer(r'\b(?:' + pattern + r')\b', sentence, re.I):
                prefix = sentence[max(0, m.start() - 30):m.start()]
                if not re.search(r'\b(?:not|without|instead of|rather than)\s+(?:an?\s+)?$', prefix, re.I):
                    found.append((m.start(), m.end(), name))

        if not found:
            continue

        found.sort()
        deduped = []
        for f in found:
            if not deduped or f[0] >= deduped[-1][1]:
                deduped.append(f)
            elif f[2] != deduped[-1][2]:
                deduped.append(f)

        i = 0
        while i < len(deduped):
            group = {deduped[i][2]}
            while i + 1 < len(deduped):
                between = sentence[deduped[i][1]:deduped[i + 1][0]]
                if re.search(r'^\s*(?:or|/|,?\s*or)\s*$', between, re.I):
                    group.add(deduped[i + 1][2])
                    i += 1
                else:
                    break
            groups.append(group)
            i += 1

    if not groups:
        return []

    try:
        tree = ast.parse(code)
    except SyntaxError:
        return sorted({name for g in groups for name in g})

    used = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load)}
    present = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if (alias.asname or alias.name.split('.')[0]) in used:
                    present.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            if any((alias.asname or alias.name) in used for alias in node.names):
                present.add(node.module.split('.')[0])
                if node.module.startswith('tensorflow.keras') or (
                    node.module == 'tensorflow' and any(a.name == 'keras' and (a.asname or a.name) in used for a in node.names)
                ):
                    present.add('keras')

    tensorflow_aliases = {
        a.asname or a.name
        for n in ast.walk(tree)
        if isinstance(n, ast.Import)
        for a in n.names
        if a.name == 'tensorflow'
    }
    if any(
        isinstance(n, ast.Attribute)
        and n.attr == 'keras'
        and isinstance(n.value, ast.Name)
        and n.value.id in tensorflow_aliases
        for n in ast.walk(tree)
    ):
        present.add('keras')

    missing = []
    for g in groups:
        if not (g & present):
            missing.append(" or ".join(sorted(g)))

    return sorted(set(missing))

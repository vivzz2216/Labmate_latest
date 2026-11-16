"""Prevent explicitly requested notebook libraries from being silently replaced."""
import ast
import re

from .notebook_magics import neutralize_magics

# A line that is only an import statement is the manual's own sample code, not an instruction to the student.
CODE_IMPORT = re.compile(
    r'^\s*(?:import\s+[\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*'
    r'|from\s+[\w.]+\s+import\s+[\w.*, ()]+)\s*;?\s*$')

LIBRARIES = {
    'pyspark': r'pyspark',
    'numpy': r'numpy', 'pandas': r'pandas', 'sklearn': r'scikit[ -]?learn|sklearn',
    'scipy': r'scipy', 'matplotlib': r'matplotlib', 'seaborn': r'seaborn',
    'nltk': r'nltk', 'skfuzzy': r'scikit[ -]?fuzzy|skfuzzy', 'pgmpy': r'pgmpy',
    'torch': r'pytorch|torch', 'tensorflow': r'tensorflow', 'keras': r'keras',
    'networkx': r'networkx', 'bs4': r'beautiful[ ]?soup|bs4',
}


def alternative_groups(sentence,names):
    """Group libraries a sentence offers as alternatives ("PyTorch or Keras"); any one satisfies it."""
    mentions=sorted((match.start(),match.end(),name) for name in names
                    for match in re.finditer(r'\b(?:'+LIBRARIES[name]+r')\b',sentence,re.I))
    groups=[]
    for start,end,name in mentions:
        if groups and re.fullmatch(r'\s*(?:,\s*)?(?:or|/)\s*(?:an?\s+|the\s+)?',sentence[groups[-1][1]:start],re.I):
            groups[-1][0].add(name);groups[-1][1]=end
        else:groups.append([{name},end])
    return [group for group,_ in groups]


def missing_required_libraries(question, code):
    required=[]
    # Requirements come from the prose. A manual that prints its own program lists its imports as code
    # (import numpy as np), and those lines must not turn every imported library into a requirement.
    prose='\n'.join(line for line in question.splitlines() if not CODE_IMPORT.match(line))
    for sentence in re.split(r'[\n.!?]+', prose):
        if not re.search(r'\b(?:use|using|import|with|require[sd]?)\b',sentence,re.I):
            continue
        if re.search(r'\b(?:optional|may use|can use|if available)\b',sentence,re.I):
            continue
        names={name for name,pattern in LIBRARIES.items()
               if re.search(r'\b(?:'+pattern+r')\b',sentence,re.I)
               and not re.search(r'\b(?:not|without|instead of|rather than)\s+(?:an?\s+)?(?:'+pattern+r')\b',sentence,re.I)}
        for group in alternative_groups(sentence,names):
            if group not in required:required.append(group)
    if not required:return []
    label=lambda group:' or '.join(sorted(group))
    # IPython magics (%pip, !pip) are not Python; they are skipped at run time, so they must not break parsing here.
    try:tree=ast.parse(neutralize_magics(code))
    except SyntaxError:
        # A real syntax error is reported by the run itself, with its traceback. Claiming that every
        # requested library is missing would hide the actual cause.
        return []
    used={node.id for node in ast.walk(tree) if isinstance(node,ast.Name) and isinstance(node.ctx,ast.Load)}
    present=set()
    for node in ast.walk(tree):
        if isinstance(node,ast.Import):
            for alias in node.names:
                if (alias.asname or alias.name.split('.')[0]) in used:present.update(alias.name.split('.'))
        elif isinstance(node,ast.ImportFrom) and node.module:
            imported=[alias.name for alias in node.names if (alias.asname or alias.name) in used]
            if imported:present.update(node.module.split('.'));present.update(imported)
    # pandas is also used without ever naming the module: load_iris(as_frame=True) returns a DataFrame and its methods do the work.
    imports_pandas=any(isinstance(node,ast.Import) and any(alias.name.split('.')[0]=='pandas' for alias in node.names)
                       or isinstance(node,ast.ImportFrom) and (node.module or '').split('.')[0]=='pandas' for node in ast.walk(tree))
    if imports_pandas and 'pandas' not in present:
        frame_idioms={'frame','groupby','describe','value_counts','iloc','loc','head','agg','pivot_table','merge'}
        if any(isinstance(node,ast.keyword) and node.arg=='as_frame' for node in ast.walk(tree)) or \
           any(isinstance(node,ast.Attribute) and node.attr in frame_idioms for node in ast.walk(tree)):
            present.add('pandas')
    # tf.keras is Keras: importing TensorFlow and using its keras attribute satisfies a Keras requirement.
    if 'tensorflow' in present and any(isinstance(node,ast.Attribute) and node.attr=='keras' for node in ast.walk(tree)):
        present.add('keras')
    return sorted(label(group) for group in required if not group&present)

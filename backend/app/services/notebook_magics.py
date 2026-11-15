"""IPython magic lines in notebook source.

Colab programs routinely begin with ``%pip install ...`` or ``!pip install ...``. Those lines are not Python, so
they break parsing and every check that parses the code, and this runtime is offline with its libraries
preinstalled. They are commented out rather than executed, and every line number stays the same.
"""
import ast
import re

_MAGIC = re.compile(r'^(\s*)((?:%%?[A-Za-z_]|![A-Za-z./_~$]).*)$')
_TRIPLE_QUOTE = re.compile(r'"""|\'\'\'')
_NOTE = '  # (IPython magic skipped)'


def neutralize_magics(code):
    """Comment out IPython magic lines (``%pip``, ``!pip``, ``%matplotlib``, ``%%time``) so the cell is valid Python.

    Valid Python is returned untouched, so a line that merely continues an expression (for example a leading
    ``%`` operator) is never mistaken for a magic. Lines inside triple-quoted strings are left alone.
    """
    if not isinstance(code, str) or ('%' not in code and '!' not in code):
        return code
    try:
        ast.parse(code)
        return code
    except (SyntaxError, ValueError):
        pass
    lines = code.splitlines(keepends=True)
    quote = None
    changed = False
    for index, line in enumerate(lines):
        body = line.rstrip('\r\n')
        ending = line[len(body):]
        if quote is None:
            match = _MAGIC.match(body)
            if match:
                lines[index] = f'{match.group(1)}# {match.group(2)}{_NOTE}{ending}'
                changed = True
                continue
        for token in _TRIPLE_QUOTE.findall(body):
            quote = token if quote is None else (None if quote == token else quote)
    return ''.join(lines) if changed else code

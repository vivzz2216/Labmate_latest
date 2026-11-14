"""Static policy for generated R lab scripts.

Defense in depth only: R runs inside the isolated runtime worker in production. These checks stop a generated
script from reaching the host, the network, other processes or the R session itself, and from using packages
that are not installed in the lab image.
"""
import re

R_ALLOWED_PACKAGES = {
    'base', 'stats', 'graphics', 'grDevices', 'utils', 'datasets', 'methods', 'tools', 'splines', 'stats4', 'grid',
    'ggplot2', 'dplyr', 'tidyr', 'tibble', 'scales', 'reshape2', 'MASS', 'lattice', 'boot', 'class', 'cluster',
    'nnet', 'rpart', 'survival', 'e1071', 'randomForest'}

# Reach the host, network, other processes or the session. Rejected anywhere in the source (even bare, as in
# lapply(x, system), or inside a string, as in do.call("system", ...)).
R_FORBIDDEN_ANYWHERE = (
    'system', 'system2', 'shell', 'shell.exec', 'pipe', 'fifo', 'socketConnection', 'socketSelect', 'serverSocket',
    'download.file', 'Sys.setenv', 'Sys.getenv', 'Sys.unsetenv', 'Sys.chmod', 'Sys.umask', 'Sys.info', 'Sys.setlocale',
    'Sys.setFileTime', 'setwd', 'commandArgs', 'R.home', 'install.packages', 'remove.packages', 'update.packages',
    'dyn.load', 'dyn.unload', 'library.dynam', '.C', '.Call', '.External', '.Fortran', '.Internal',
    'assignInNamespace', 'unlockBinding', 'lockBinding', 'setHook', 'sys.source', 'sys.call', 'sys.function',
    'getNamespace', 'getFromNamespace', 'loadNamespace', 'attachNamespace', 'match.fun', 'readRenviron',
    'save.image', 'browseURL', 'file.show', 'file.edit', 'dir.create')
# Ordinary words as variable names (q, url, edit, source), so only a call is rejected.
R_FORBIDDEN_CALLS = ('q', 'quit', 'sink', 'url', 'download', 'curl', 'edit', 'fix', 'eval', 'evalq', 'source', 'parent.env', 'topenv')

_NAME = r'(?<![A-Za-z0-9._$@])'
_FORBIDDEN = re.compile(_NAME + '(?:' + '|'.join(re.escape(n) for n in R_FORBIDDEN_ANYWHERE) + r')(?![A-Za-z0-9._])')
_FORBIDDEN_CALL = re.compile(_NAME + '(?:' + '|'.join(re.escape(n) for n in R_FORBIDDEN_CALLS) + r')\s*\(')
_LIBRARY = re.compile(r'\b(?:library|require|requireNamespace)\s*\(\s*["\']?([A-Za-z][A-Za-z0-9.]*)')
_NAMESPACE = re.compile(r'\b([A-Za-z][A-Za-z0-9.]*):::?[A-Za-z.]')
_DO_CALL_TEXT = re.compile(r'\bdo\.call\s*\(\s*["\']')
_PARSE_TEXT = re.compile(r'\bparse\s*\(\s*text\b')
_DRIVE = re.compile(r'^[A-Za-z]:[\\/]')
_URL = re.compile(r'^[a-z][a-z0-9+.-]*://', re.I)


def scan_r(code):
    """Return (code without comments, string literals)."""
    out, strings, i, n = [], [], 0, len(code)
    while i < n:
        c = code[i]
        if c == '#':
            while i < n and code[i] != '\n':
                i += 1
            continue
        if c in '"\'`':
            quote, start = c, i
            i += 1
            while i < n and code[i] != quote:
                i += 2 if code[i] == '\\' else 1
            i += 1
            if quote != '`':
                strings.append(code[start + 1:i - 1])
            out.append(code[start:i])
            continue
        out.append(c)
        i += 1
    return ''.join(out), strings


def validate_r_code(code):
    if len(code) > 50000:
        raise ValueError("Generated code exceeds the supported size.")
    text, strings = scan_r(code)
    found = _FORBIDDEN.search(text) or _FORBIDDEN_CALL.search(text)
    if found:
        raise ValueError("This R program uses %s, which the lab runtime does not allow." % found.group(0).rstrip('( 	'))
    if _DO_CALL_TEXT.search(text) or _PARSE_TEXT.search(text):
        raise ValueError("This R program builds code from text, which the lab runtime does not allow.")
    packages = set(_LIBRARY.findall(text)) | set(_NAMESPACE.findall(text))
    missing = sorted(p for p in packages if p not in R_ALLOWED_PACKAGES)
    if missing:
        raise ValueError("R package %s is not available in the lab runtime." % ", ".join(missing))
    for literal in strings:
        value = literal.strip()
        if value in R_FORBIDDEN_ANYWHERE:
            raise ValueError("This R program uses %s, which the lab runtime does not allow." % value)
        if _URL.match(value):
            raise ValueError("R programs cannot use network addresses in the lab runtime.")
        if (len(value) > 1 and value.startswith(('/', '~', '\\\\'))) or _DRIVE.match(value) or '../' in value or '..\\' in value:
            raise ValueError("R file access must stay inside the lab working directory.")

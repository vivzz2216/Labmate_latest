"""Real R execution with an RStudio-style evidence renderer.

The student's script runs under a real Rscript. Its console transcript, plots, Global Environment and
working-directory files come back as one JSON receipt (r_harness.R); the RStudio workspace is then drawn
from that receipt. Nothing is simulated: if R is missing or the script fails, no evidence is invented.
"""
import asyncio
import base64
import glob
import json
import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path

from ..config import settings

SOURCE_LINES = 15          # editor rows that fit in one frame at the 1440x960 workspace
CONSOLE_LINES = 22         # console rows that fit in one frame
MAX_SOURCE_LINES = 150
MAX_CONSOLE_FRAMES = 12
MAX_PLOT_FRAMES = 6
MAX_VIEW_FRAMES = 3
R_TIMEOUT_SEC = 60
VIEWPORT = {'width': 1440, 'height': 960}
SCALE = 1.5
HARNESS = Path(__file__).with_name('r_harness.R')
RESOURCE_LIMITS = {'max_memory_bytes': 3 * 1024**3, 'max_cpu_seconds': 50, 'max_procs': 256}


class RUnavailable(RuntimeError):
    """R is not installed on this host; nothing can be verified."""


def _version_key(path):
    match = re.search(r'R-(\d+)\.(\d+)\.(\d+)', path)
    return tuple(int(part) for part in match.groups()) if match else (0, 0, 0)


def find_rscript():
    configured = (getattr(settings, 'R_COMMAND', '') or 'Rscript').strip()
    if Path(configured).is_file():
        return configured
    found = shutil.which(configured)
    if found:
        return found
    if os.name == 'nt':
        roots = [os.environ.get('ProgramFiles', r'C:\Program Files'),
                 os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs')]
        candidates = [path for root in roots if root for path in glob.glob(os.path.join(root, 'R', 'R-*', 'bin', 'Rscript.exe'))]
        if candidates:
            return sorted(candidates, key=_version_key)[-1]
    return None


def r_instructions():
    return '''
R RUNTIME (real Rscript, shown in an RStudio workspace): Return one complete R script (.R) that runs top to
bottom without user input. The runner evaluates it expression by expression exactly like the RStudio console,
so auto-printing works: a bare expression such as summary(x) or head(df) prints its value; use print() or cat()
only when the lab asks for formatted output. Rules:
- Base R plus these packages only: ggplot2, dplyr, tidyr, tibble, scales, reshape2, MASS, lattice, boot, class,
  cluster, nnet, rpart, survival, e1071, randomForest. Load them with library(); never install.packages().
- No internet: use built-in datasets (mtcars, iris, airquality, ToothGrowth, women, faithful, cars, ChickWeight)
  or small data built in the script. Never download files or read URLs.
- No system()/shell()/Sys.getenv()/setwd()/source()/eval(parse()), no absolute or ".." paths. Reading or writing
  a file in the working directory by bare name (write.csv(df, "out.csv")) is fine.
- Never call readline()/scan()/readLines(stdin); put the sample values in the script. Do not call q().
- Draw plots with plot()/hist()/barplot()/boxplot()/ggplot(); each plot is captured in the RStudio Plots pane.
  Do not open png()/pdf() devices unless the lab asks to save a file. set.seed(42) before anything random.
- Keep the script <= 120 lines, each line <= 90 characters, with a short # comment per step. Keep printed output
  <= 120 lines (use head()). Code and results must come from real computation, never typed-in imitations.
Return browser_tests=[]. stdin must be empty.
'''


def _lines(code):
    lines = code.splitlines()
    return lines or ['']


def _balanced_sizes(total, capacity):
    """Split `total` rows into the fewest frames of near-equal size, so no frame is a 2-line stub."""
    count = max(1, -(-total // capacity))
    base, extra = divmod(total, count)
    return [base + (1 if i < extra else 0) for i in range(count)]


def _chunks(items, size):
    pieces, start = [], 0
    for length in _balanced_sizes(len(items), size):
        pieces.append(items[start:start + length])
        start += length
    return pieces


def _data_uri(path):
    raw = Path(path).read_bytes()
    if not raw.startswith(b'\x89PNG\r\n\x1a\n') or not 100 < len(raw) <= 3 * 1024**2:
        raise ValueError('R produced an invalid plot image.')
    return 'data:image/png;base64,' + base64.b64encode(raw).decode()


async def run_r_script(code, filename, stdin=''):
    """Execute under a real R and return the harness receipt (plots as data URIs)."""
    from .runtime_engine import run_process
    rscript = find_rscript()
    if not rscript:
        raise RUnavailable('R is not installed on this server (Rscript was not found). Install R or set R_COMMAND.')
    root = Path(settings.REACT_TEMP_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='labmate_r_', dir=root) as folder:
        base = Path(folder)
        work, out = base / 'work', base / 'out'
        work.mkdir()
        out.mkdir()
        (work / filename).write_bytes(code.replace('\r\n', '\n').encode('utf-8'))
        harness = base / 'r_harness.R'
        shutil.copyfile(HARNESS, harness)
        stdin_file = out / 'stdin.txt'
        stdin_file.write_text(stdin or '', encoding='utf-8')
        extras = {'R_ENVIRON_USER': '', 'R_PROFILE_USER': '', 'OMP_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1',
                  'R_DEFAULT_PACKAGES': 'datasets,utils,grDevices,graphics,stats,methods'}
        if getattr(settings, 'R_LIBS', ''):
            extras['R_LIBS'] = settings.R_LIBS
        if os.name != 'nt':
            extras.update(LANG='C.UTF-8', LC_ALL='C.UTF-8')
        result = await run_process([rscript, '--vanilla', str(harness), str(work / filename), str(out), str(stdin_file)],
                                   work, timeout=R_TIMEOUT_SEC, extras=extras, resource_limits=RESOURCE_LIMITS)
        receipt_path = out / 'result.json'
        if not receipt_path.is_file():
            detail = (result.error or result.output or '').strip()[-800:]
            if result.exit_code == 124:
                detail = 'R exceeded the %d second limit. %s' % (R_TIMEOUT_SEC, detail)
            raise ValueError('R did not produce a result. ' + detail)
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        receipt['plot_uris'] = [_data_uri(out / name) for name in receipt.get('plots', [])
                                if re.fullmatch(r'plot_d\d+_\d+\.png', name)]
        receipt['process_stderr'] = (result.error or '')[-500:]
        return receipt


def console_text(receipt):
    return '\n'.join(item['text'] for item in receipt.get('lines', []) if item.get('k') in {'out', 'msg', 'warn', 'err'}).strip()


def _frame_data(receipt, theme, name, code, *, first, last, cursor, console, env, history=None,
                right_tab='files', plot=None, plot_index=0, plot_count=0, files=None, active_view=-1, views=None):
    return {'theme': theme, 'rShort': receipt.get('rShort', 'R'), 'workdir': '~/',
            'file': {'name': name, 'code': code}, 'firstLine': first, 'lastLine': last, 'cursorLine': cursor,
            'console': console, 'env': env, 'history': history or [], 'envTab': 'environment',
            'rightTab': right_tab, 'plot': plot, 'plotIndex': plot_index, 'plotCount': plot_count,
            'files': files if files is not None else receipt.get('files', []),
            'packages': receipt.get('packages', []), 'views': views or [], 'activeView': active_view}


def build_frames(receipt, code, name, theme):
    """Describe every evidence frame; render_frames() draws them."""
    total = len(_lines(code))
    banner = [{'k': 'out', 'text': text} for text in receipt.get('banner', [])]
    fresh = banner[-(CONSOLE_LINES - 1):] + [{'k': 'prompt', 'text': ''}]
    own_file = [{'name': name, 'size': len(code.encode('utf-8'))}]
    frames = []
    start = 1
    for length in _balanced_sizes(total, SOURCE_LINES):
        end = start + length - 1
        frames.append({
            'kind': 'source_preview', 'caption': f'RStudio source editor — {name}, lines {start}–{end}',
            'source_file': name, 'source_ranges': [(start, end)],
            'data': _frame_data(receipt, theme, name, code, first=start, last=end, cursor=start, console=fresh,
                                env=[], right_tab='files', files=own_file)})
        start = end + 1
    console = list(receipt.get('lines', []))
    capacity = MAX_CONSOLE_FRAMES * CONSOLE_LINES
    if len(console) > capacity:
        console = console[:capacity - 1] + [{'k': 'out', 'text': '[ output truncated: %d more lines ]' % (len(console) - capacity + 1)}]
    pieces = _chunks(console, CONSOLE_LINES)
    if len(pieces[0]) < CONSOLE_LINES:
        pad = CONSOLE_LINES - len(pieces[0])
        pieces[0] = banner[-pad:] + pieces[0] if len(pieces) == 1 else pieces[0]
    plots = receipt.get('plot_uris', [])
    last_first = max(1, total - SOURCE_LINES + 1)
    env, history = receipt.get('env', []), receipt.get('history', [])
    tail = pieces[-1]

    def result(piece, **extra):
        return _frame_data(receipt, theme, name, code, first=last_first, last=total, cursor=total, console=piece,
                           env=env, history=history, **extra)
    for index, piece in enumerate(pieces, 1):
        label = f'RStudio console and Environment — part {index} of {len(pieces)}' if len(pieces) > 1 else 'RStudio console and Environment'
        extra = {'right_tab': 'plots', 'plot': plots[-1], 'plot_index': len(plots) - 1, 'plot_count': len(plots)} if plots else {}
        frames.append({'kind': 'rstudio', 'caption': label + (' with the latest plot' if plots else ''), 'data': result(piece, **extra)})
    for index, uri in enumerate(plots[:-1][:MAX_PLOT_FRAMES - 1]):  # the latest plot already appears with the console
        frames.append({'kind': 'rstudio', 'caption': f'RStudio Plots pane — plot {index + 1} of {len(plots)}',
                       'data': result(tail, right_tab='plots', plot=uri, plot_index=index, plot_count=len(plots))})
    views = receipt.get('views', [])[:MAX_VIEW_FRAMES]
    for index, view in enumerate(views):
        frames.append({'kind': 'rstudio', 'caption': f'RStudio data viewer — {view["title"]}',
                       'data': result(tail, views=views, active_view=index, right_tab='files')})
    return frames


def render_frames(frames, out_dir, stem):
    """Draw each described frame in the RStudio workspace. Blocking; run in a worker thread."""
    from .browser_capture import acquire_capture_context_sync
    from .lab_resources import allowed_resource, resource_file
    html = resource_file('rstudio', 'index.html')
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    rendered = []
    with acquire_capture_context_sync(viewport=VIEWPORT, device_scale_factor=SCALE, service_workers='block') as context:
        context.route('**/*', lambda route: route.continue_() if allowed_resource(route.request.url, html.parent) else route.abort())
        page = context.new_page()
        page.set_default_timeout(30000)
        page.goto(html.as_uri(), wait_until='domcontentloaded')
        page.wait_for_function('!!window.__rstudioApi')
        for number, frame in enumerate(frames, 1):
            page.evaluate('(d)=>window.RStudioIDE.load(d)', frame['data'])
            page.evaluate('()=>Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})))')
            path = Path(out_dir) / f'{stem}_{number:02d}.png'
            page.screenshot(path=str(path))
            rendered.append({'path': str(path), 'kind': frame['kind'], 'caption': frame['caption'],
                             **{key: frame[key] for key in ('source_file', 'source_ranges') if key in frame},
                             'width': int(VIEWPORT['width'] * SCALE), 'height': int(VIEWPORT['height'] * SCALE)})
    return rendered


def execution_enabled():
    """Same gate notebooks use: the beta allowlist (or an open local install where that helper exists)."""
    try:
        from ..security.operator_access import execution_opted_in
    except ImportError:
        return bool(settings.EXECUTION_ALLOWED_EMAILS.strip())
    return execution_opted_in()


async def capture_r(code, filename=None, stdin='', objective='', theme='light'):
    from .runtime_engine import RuntimeResult
    verification = {'kind': 'rstudio', 'required': True, 'status': 'failed', 'engine': 'R', 'runtime': 'Rscript',
                    'evidence_frames': [], 'theme': theme}
    try:
        from ..security.generated_code import validate_generated_code
        if not execution_enabled():
            raise ValueError('R execution requires an explicit beta execution allowlist.')
        if theme not in {'light', 'dark'}:
            raise ValueError('Choose a light or dark RStudio theme.')
        if not isinstance(code, str) or not code.strip():
            raise ValueError('Invalid R source.')
        filename = filename or 'script.R'
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.[Rr]', filename):
            raise ValueError('R source needs a safe .R basename.')
        validate_generated_code(code, 'r')
        if len(_lines(code)) > MAX_SOURCE_LINES:
            raise ValueError('R script exceeds the %d line evidence limit; split the experiment.' % MAX_SOURCE_LINES)
        receipt = await run_r_script(code, filename, stdin)
        frames = build_frames(receipt, code, filename, theme)
        root = Path(settings.SCREENSHOT_DIR).resolve()
        rendered = await asyncio.to_thread(render_frames, frames, root, f'rstudio_{uuid.uuid4().hex}')
        error = receipt.get('error') or ''
        passed = not error and bool(rendered)
        verification.update(status='passed' if passed else 'failed', engine=receipt.get('rVersion', 'R'),
                            evidence_frames=rendered, source_lines=len(_lines(code)), plots=len(receipt.get('plot_uris', [])),
                            seconds=receipt.get('seconds'), packages=[p['name'] for p in receipt.get('packages', []) if p.get('loaded')])
        return RuntimeResult(passed, console_text(receipt), error, 0 if passed else 1,
                             screenshots={f'rstudio_{i}': frame['path'] for i, frame in enumerate(rendered)},
                             verification=verification,
                             stages={'execution': 'passed' if not error else 'failed', 'capture': 'passed' if rendered else 'failed'})
    except RUnavailable as exc:
        verification['error'] = str(exc)
        return RuntimeResult(False, error=str(exc), exit_code=69, verification=verification,
                             stages={'execution': 'not_run', 'capture': 'not_run'})
    except (ValueError, OSError, TimeoutError, KeyError, json.JSONDecodeError) as exc:
        verification['error'] = str(exc)
        return RuntimeResult(False, error=str(exc), exit_code=1, verification=verification,
                             stages={'execution': 'failed', 'capture': 'not_run'})

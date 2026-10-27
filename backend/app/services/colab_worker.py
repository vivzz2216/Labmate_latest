#!/usr/bin/env python3
"""
Google Colab Dedicated Execution, Screenshot, Print-PDF & Word (.docx) Pipeline
Supports:
  - Option 1: Auto-Dataset Provisioning & Synthesis from Code AST/Column references
  - Option 2: Teacher-Supplied Dataset Paste/Upload (.csv) + Verbatim Code Upload (.py / .ipynb)
  - Anti-AI Student Personalization: Dynamic Avatar Initial (A, R, P, S...) + Natural Filename (DSLab_Name_Exp6.ipynb)
  - Multi-Student Isolated Worker Queue: Per-student isolated runtime directories + bounded worker concurrency
"""

import ast
import base64
import io
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import traceback
import warnings
import uuid
import hashlib
import builtins
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from contextlib import redirect_stdout, redirect_stderr
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
import sklearn
import sklearn.metrics
import sklearn.model_selection
import sklearn.preprocessing
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt



WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLAB_HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")

_KERNEL_LOCK = threading.Lock()
_RENDER_LOCK = threading.Lock()


# ==============================================================================
# 1. PANDAS 1.x -> 3.x & SKLEARN UNIVERSITY LAB MANUAL COMPATIBILITY SHIMS
# ==============================================================================
def configure_colab_matplotlib_theme():
    """Configure Matplotlib to match Google Colab Pro Dark Mode output aesthetics."""
    plt.rcParams.update({
        "figure.facecolor": "#1e1f20",
        "axes.facecolor": "#282a2c",
        "axes.edgecolor": "#5f6368",
        "axes.labelcolor": "#e3e3e3",
        "text.color": "#e3e3e3",
        "xtick.color": "#c4c7c5",
        "ytick.color": "#c4c7c5",
        "grid.color": "#3c4043",
        "grid.linestyle": "--",
        "grid.alpha": 0.6,
        "legend.facecolor": "#282a2c",
        "legend.edgecolor": "#444746",
        "figure.dpi": 110,
        "savefig.dpi": 110,
        "savefig.bbox": "tight",
        "savefig.facecolor": "#1e1f20",
    })
    if os.environ.get('LABMATE_NOTEBOOK_THEME')=='light':
        plt.rcParams.update({'figure.facecolor':'white','axes.facecolor':'white',
            'axes.edgecolor':'#5f6368','axes.labelcolor':'#202124','text.color':'#202124',
            'xtick.color':'#3c4043','ytick.color':'#3c4043','grid.color':'#dadce0',
            'legend.facecolor':'white','legend.edgecolor':'#dadce0','savefig.facecolor':'white'})


# ==============================================================================
# 2. OPTION 1 & OPTION 2 DATASET MANAGER (TEACHER PASTE/UPLOAD + AUTO SYNTHESIS)
# ==============================================================================
def ensure_home_loan_dataset(target_dir: str) -> str:
    """
    Generate realistic 'home_loan_train.csv' matching the Kaggle Home Loan Dataset
    used in St. Francis Institute of Technology - Data Science Lab Experiment 6.
    """
    csv_path = os.path.join(target_dir, "home_loan_train.csv")
    if os.path.exists(csv_path):
        return csv_path

    rng = np.random.default_rng(42)
    n = 200

    genders = rng.choice(["Male", "Female"], size=n, p=[0.81, 0.19])
    married = rng.choice(["Yes", "No"], size=n, p=[0.65, 0.35])
    dependents = rng.choice([0, 1, 2, 3], size=n, p=[0.57, 0.17, 0.16, 0.10])
    education = rng.choice(["Graduate", "Not Graduate"], size=n, p=[0.78, 0.22])
    self_employed = rng.choice(["No", "Yes"], size=n, p=[0.86, 0.14])
    app_income = rng.integers(1800, 14500, size=n).astype(float)
    coapp_income = rng.choice([0.0, 1200.0, 1850.0, 2400.0, 3100.0, 4200.0], size=n, p=[0.42, 0.15, 0.15, 0.12, 0.08, 0.08])
    loan_amount = np.round(app_income * 0.025 + rng.normal(45, 22, size=n), 1)
    loan_amount = np.clip(loan_amount, 35.0, 480.0)
    loan_term = rng.choice([360.0, 180.0, 300.0, 240.0], size=n, p=[0.84, 0.08, 0.04, 0.04])
    credit_history = rng.choice([1.0, 0.0], size=n, p=[0.84, 0.16])
    property_area = rng.choice(["Semiurban", "Urban", "Rural"], size=n, p=[0.38, 0.33, 0.29])

    score = (
        credit_history * 2.4
        + (education == "Graduate") * 0.35
        + (married == "Yes") * 0.2
        + ((app_income + coapp_income) / (loan_amount * 35.0)) * 0.45
        + rng.normal(0, 0.35, size=n)
    )
    loan_status = np.where(score > 1.65, "Y", "N")

    loan_amount[rng.choice(n, 5, replace=False)] = np.nan
    credit_history[rng.choice(n, 4, replace=False)] = np.nan

    df = pd.DataFrame({
        "Loan_ID": [f"LP00{1001 + i}" for i in range(n)],
        "Gender": genders,
        "Married": married,
        "Dependents": dependents,
        "Education": education,
        "Self_Employed": self_employed,
        "ApplicantIncome": app_income,
        "CoapplicantIncome": coapp_income,
        "LoanAmount": loan_amount,
        "Loan_Amount_Term": loan_term,
        "Credit_History": credit_history,
        "Property_Area": property_area,
        "Loan_Status": loan_status,
    })
    df.to_csv(csv_path, index=False)
    return csv_path


def synthesize_csv_from_code(code_text: str, csv_path: str):
    """
    Option 1 Fallback: Inspect Python code for DataFrame column names (e.g. df['Age'],
    drop('ID')) and generate a matching synthetic CSV dataset when no CSV was uploaded.
    """
    rng = np.random.default_rng(42)
    n = 150

    bracket_cols = re.findall(r"\[\s*['\"]([A-Za-z_][A-Za-z0-9_ ]*)['\"]\s*\]", code_text or "")
    drop_cols = re.findall(r"drop\(\s*['\"]([A-Za-z_][A-Za-z0-9_ ]*)['\"]", code_text or "")
    all_cols = []
    for c in bracket_cols + drop_cols:
        if c not in all_cols and not c.endswith(".csv"):
            all_cols.append(c)

    home_loan_cols = {"Gender", "Married", "Education", "Self_Employed", "Property_Area", "Loan_Status"}
    if home_loan_cols.issubset(set(all_cols)) or os.path.basename(csv_path).lower() == "home_loan_train.csv":
        tmp_dir = os.path.dirname(os.path.abspath(csv_path))
        hl_path = ensure_home_loan_dataset(tmp_dir)
        if os.path.abspath(hl_path) != os.path.abspath(csv_path):
            shutil.copyfile(hl_path, csv_path)
        return

    data = {}
    for col in all_cols:
        cl = col.lower()
        if "id" in cl:
            data[col] = [1001 + i for i in range(n)]
        elif cl in ("gender", "sex"):
            data[col] = rng.choice(["Male", "Female"], size=n)
        elif any(k in cl for k in ("married", "employed", "smoker", "churn", "approved", "default")):
            data[col] = rng.choice(["Yes", "No"], size=n)
        elif any(k in cl for k in ("status", "target", "label", "class", "purchased", "outcome", "survived")):
            data[col] = rng.choice([0, 1], size=n, p=[0.4, 0.6])
        elif any(k in cl for k in ("education", "degree")):
            data[col] = rng.choice(["Graduate", "Not Graduate"], size=n)
        elif any(k in cl for k in ("area", "region", "city", "department", "category", "species")):
            data[col] = rng.choice(["Category_A", "Category_B", "Category_C"], size=n)
        elif any(k in cl for k in ("age", "years", "experience", "tenure")):
            data[col] = rng.integers(20, 60, size=n).astype(float)
        elif any(k in cl for k in ("income", "salary", "price", "sales", "amount", "balance", "charges")):
            data[col] = np.round(rng.uniform(2500.0, 95000.0, size=n), 2)
        else:
            data[col] = np.round(rng.normal(50.0, 15.0, size=n), 2)

    if len(data) < 3:
        data.setdefault("Feature_1", np.round(rng.normal(10.0, 2.5, size=n), 2))
        data.setdefault("Feature_2", np.round(rng.normal(25.0, 5.0, size=n), 2))
        data.setdefault("Feature_3", np.round(rng.normal(50.0, 10.0, size=n), 2))
        data.setdefault("Target", rng.choice([0, 1], size=n))

    pd.DataFrame(data).to_csv(csv_path, index=False)


def provision_datasets_for_code(
    code_text: str,
    work_dir: str,
    teacher_datasets: Optional[Dict[str, Union[str, bytes]]] = None,
    allow_synthetic: bool = False,
):
    """
    Option 2 First: Write any teacher-pasted or uploaded CSV datasets directly to work_dir.
    Option 1 Fallback: Auto-provision any other CSV filenames referenced in read_csv(...).
    """
    os.makedirs(work_dir, exist_ok=True)
    generated = []

    # 1. Option 2: Write teacher-supplied datasets (raw CSV text, bytes, or existing file path)
    if teacher_datasets:
        for fname, content in teacher_datasets.items():
            dest_path = str(dataset_path(fname, work_dir))
            if os.path.exists(dest_path):
                continue
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            if isinstance(content, bytes):
                with open(dest_path, "wb") as f:
                    f.write(content)
            elif isinstance(content, str):
                with open(dest_path, "w", encoding="utf-8", newline="") as f:
                    f.write(content)

    # 2. Option 1 Fallback: Check all read_csv('...') calls in code
    csv_matches = re.findall(r"read_csv\(\s*['\"]([^'\"]+\.csv)['\"]", code_text or "")
    for csv_name in csv_matches:
        target_path = str(dataset_path(csv_name, work_dir))
        if allow_synthetic and not os.path.exists(target_path):
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            synthesize_csv_from_code(code_text, target_path)
            generated.append(str(Path(target_path).relative_to(Path(work_dir))))
    return generated


def dataset_path(name, work_dir):
    name = os.fspath(name).replace('\\', '/')
    if name.startswith('/content/drive/'):
        raise ValueError('Upload the Drive dataset into this lab; a Google Drive mount is unavailable.')
    if name.startswith('/content/'):
        name = name[len('/content/'):]
    path = (Path(work_dir) / name).resolve()
    if not path.is_relative_to(Path(work_dir).resolve()):
        raise PermissionError('Dataset paths must stay inside the private lab workspace.')
    return path


# ==============================================================================
# 3. STATEFUL MULTI-CELL PYTHON KERNEL EXECUTOR (ISOLATED PER STUDENT)
# ==============================================================================
class LimitedText(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > 1024 * 1024:
            raise ValueError('Notebook output exceeds 1 MiB.')
        return super().write(text)


class NotebookKernelWorker:
    """Executes Python notebook cells statefully in an isolated per-student workspace."""

    def __init__(
        self,
        work_dir: Optional[str] = None,
        teacher_datasets: Optional[Dict[str, Union[str, bytes]]] = None,
        allow_synthetic: bool = False,
    ):
        self._owns_work_dir = work_dir is None
        self.work_dir = work_dir or tempfile.mkdtemp(prefix="colab_student_")
        self.teacher_datasets: Dict[str, Union[str, bytes]] = dict(teacher_datasets or {})
        self.allow_synthetic = allow_synthetic
        self.synthetic_datasets = set()
        self.reset()

    def upload_dataset(self, filename: str, content: Union[str, bytes]):
        """Option 2: Paste or upload a teacher dataset (.csv) into this student's runtime."""
        self.teacher_datasets[filename] = content
        provision_datasets_for_code("", self.work_dir, {filename: content})

    def reset(self):
        self.exec_counter = 0
        self.namespace: Dict[str, Any] = {
            "__name__": "__main__",
            "sklearn": sklearn,
            "pd": pd,
            "np": np,
            "plt": plt,
        }
        configure_colab_matplotlib_theme()
        plt.close("all")

    def cleanup(self):
        if self._owns_work_dir and os.path.exists(self.work_dir):
            shutil.rmtree(self.work_dir, ignore_errors=True)

    def execute_cell(self, code: str) -> Dict[str, Any]:
        """Run a single Python code cell thread-safely and return stdout, repr, html, plots, error, execCount, execTime."""
        with _KERNEL_LOCK:
            return self._execute_cell_unlocked(code)

    def _execute_cell_unlocked(self, code: str) -> Dict[str, Any]:
        self.exec_counter += 1
        start_ts = time.perf_counter()

        self.synthetic_datasets.update(provision_datasets_for_code(code, self.work_dir, self.teacher_datasets, self.allow_synthetic))
        old_cwd = os.getcwd()
        os.chdir(self.work_dir)

        stdout_buf = LimitedText()
        stderr_buf = LimitedText()
        last_repr: Optional[str] = None
        html_out: Optional[str] = None
        plots_b64: List[str] = []
        error_msg: Optional[str] = None

        captured_figs = []

        def _custom_show(*args, **kwargs):
            try:
                for num in plt.get_fignums():
                    if len(captured_figs) >= 12:
                        raise ValueError('A cell can capture at most 12 plots.')
                    fig = plt.figure(num)
                    buf = io.BytesIO()
                    fig.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
                    buf.seek(0)
                    b64 = base64.b64encode(buf.read()).decode("ascii")
                    captured_figs.append(f"data:image/png;base64,{b64}")
            finally:
                plt.close("all")

        orig_show = plt.show
        plt.show = _custom_show

        try:
            configure_colab_matplotlib_theme()
            with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf), warnings.catch_warnings():
                # Under pandas Copy on Write, chained inplace operations can
                # warn and leave data unchanged while the cell exits normally.
                category=getattr(pd.errors,'ChainedAssignmentError',None)
                if category is not None:warnings.simplefilter('error',category)
                tree = ast.parse(code, mode="exec")
                if tree.body and isinstance(tree.body[-1], ast.Expr):
                    last_expr_node = tree.body.pop()
                    if tree.body:
                        exec(compile(tree, filename="<colab-cell>", mode="exec"), self.namespace)
                    expr_code = compile(ast.Expression(last_expr_node.value), filename="<colab-cell>", mode="eval")
                    val = eval(expr_code, self.namespace)
                    if val is not None:
                        if isinstance(val, pd.DataFrame):
                            html_out = val.head(15).to_html(classes="colab-df-table", border=0)
                        elif isinstance(val, pd.Series):
                            html_out = val.to_frame().head(15).to_html(classes="colab-df-table", border=0)
                        else:
                            val_type_str = type(val).__module__
                            if not val_type_str.startswith("matplotlib"):
                                last_repr = repr(val)
                else:
                    exec(compile(tree, filename="<colab-cell>", mode="exec"), self.namespace)

                if plt.get_fignums():
                    _custom_show()

        except BaseException:
            error_msg = traceback.format_exc()[:65536]
        finally:
            plt.show = orig_show
            os.chdir(old_cwd)
        plots_b64.extend(captured_figs)

        elapsed = time.perf_counter() - start_ts
        exec_time_str = f"{int(round(elapsed))}s" if elapsed >= 0.5 else "0s"

        return {
            "type": "code",
            "code": code.strip(),
            "stdout": stdout_buf.getvalue().rstrip(),
            "stderr": stderr_buf.getvalue().rstrip(),
            "repr": last_repr,
            "html": html_out,
            "plots": plots_b64,
            "error": error_msg,
            "execCount": self.exec_counter,
            "execTime": exec_time_str,
            "datasets": [{"name": str(path.relative_to(Path(self.work_dir))),
                          "source": "provided" if any(dataset_path(name,self.work_dir)==path for name in self.teacher_datasets) else "synthetic" if str(path.relative_to(Path(self.work_dir))) in self.synthetic_datasets else "generated",
                          "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                         for path in Path(self.work_dir).rglob('*.csv') if path.is_file() and path.stat().st_size <= 4 * 1024 * 1024],
        }


def validate_cell(code):
    if not isinstance(code, str) or len(code) > 50000:
        raise ValueError('Notebook cells are limited to 50000 characters.')
    safe = {'numpy','pandas','sklearn','scipy','matplotlib','seaborn','math','statistics','random','collections',
            'itertools','functools','decimal','fractions','datetime','json','csv','sys','warnings',
            're','string','typing','io','operator','copy','pprint','time','nltk','skfuzzy','pgmpy','torch','tensorflow','keras'}
    for node in ast.walk(ast.parse(code)):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            modules = [x.name for x in node.names] if isinstance(node, ast.Import) else [node.module or '']
            unsafe = [m for m in modules if m.split('.')[0] not in safe]
            if unsafe:
                raise PermissionError(f'Import {unsafe} is unavailable in the restricted notebook runtime.')
        if isinstance(node, ast.Attribute) and node.attr.startswith('_'):
            raise PermissionError('Private runtime introspection is unavailable in notebook cells.')
        if isinstance(node, ast.Name) and node.id.startswith('__') and node.id != '__name__':
            raise PermissionError('Runtime introspection is unavailable in notebook cells.')
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {
                'eval','exec','compile','getattr','setattr','globals','locals','vars','breakpoint'}:
            raise PermissionError('Dynamic runtime operations are unavailable in notebook cells.')


def restrict_runtime(root):
    root = Path(root).resolve()
    reads = [Path(sys.prefix).resolve(), Path(sys.base_prefix).resolve(), root,
             Path('/usr/share/fonts'), Path('/usr/local/share/fonts'), Path('/etc/fonts'), Path('/usr/share/zoneinfo')]
    if os.environ.get('SYSTEMROOT'):
        reads.append(Path(os.environ['SYSTEMROOT'])/'Fonts')

    def checked(path, write=False):
        if isinstance(path, int):
            return
        target = Path(os.fsdecode(path)).resolve()
        allowed = [root] if write else reads
        if not any(target.is_relative_to(base) for base in allowed):
            raise PermissionError('File access outside the private notebook workspace is denied.')

    def audit(event, args):
        if event.startswith(('socket.', 'subprocess.', 'os.exec', 'os.spawn', 'os.posix_spawn')) or event in {
                'os.system','os.fork','os.forkpty','os.symlink','os.link'}:
            raise PermissionError('Network and process access are unavailable in the notebook runtime.')
        if event == 'open':
            mode, flags = args[1], args[2]
            write = isinstance(mode,str) and any(x in mode for x in 'wax+') or isinstance(flags,int) and bool(flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC))
            checked(args[0], write)
        elif event in {'os.remove','os.rmdir','os.mkdir','os.truncate','os.chdir'}:
            checked(args[0], True)
        elif event in {'os.rename','os.replace'}:
            checked(args[0], True); checked(args[1], True)
    sys.addaudithook(audit)
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (3*1024**3,3*1024**3))
        resource.setrlimit(resource.RLIMIT_CPU, (300,300))
        resource.setrlimit(resource.RLIMIT_FSIZE, (16*1024**2,16*1024**2))
    except ImportError:
        pass


def main():
    protocol = sys.stdout
    root = os.getcwd()
    configure_colab_matplotlib_theme()
    kernel = NotebookKernelWorker(work_dir=root)
    original_read_csv = pd.read_csv

    def read_csv(path, *args, **kwargs):
        if isinstance(path, (str, os.PathLike)):
            if '://' in os.fspath(path):
                raise PermissionError('Upload the dataset instead of requesting a remote URL.')
            path = dataset_path(path, root)
            if not path.exists():
                raise FileNotFoundError('Upload the referenced dataset or explicitly enable synthetic test data: ' + path.name)
        return original_read_csv(path, *args, **kwargs)
    pd.read_csv = read_csv
    original_open = builtins.open
    def notebook_open(path, *args, **kwargs):
        if isinstance(path,(str,os.PathLike)) and os.fspath(path).replace('\\','/').startswith('/content/'):
            path = dataset_path(path,root)
        return original_open(path,*args,**kwargs)
    builtins.open = notebook_open
    restrict_runtime(root)
    protocol.write(json.dumps({'ready':True,'pid':os.getpid()})+'\n'); protocol.flush()
    for line in sys.stdin:
        request={}
        try:
            request = json.loads(line)
            command = request.get('command')
            if command == 'reset':
                kernel.reset(); result = {'reset': True}
            elif command == 'upload':
                for name, data in request['datasets'].items():
                    if isinstance(data,dict) and set(data)=={'base64'}:
                        data = base64.b64decode(data['base64'],validate=True)
                    target=dataset_path(name,root)
                    target.parent.mkdir(parents=True,exist_ok=True)
                    target.write_bytes(data if isinstance(data,bytes) else data.encode('utf-8'))
                    kernel.teacher_datasets[name]=data
                kernel.allow_synthetic = bool(request.get('allow_synthetic'))
                result = {'uploaded': True}
            elif command == 'execute':
                validate_cell(request['code'])
                result = kernel.execute_cell(request['code'])
            else:
                raise ValueError('Unknown notebook command.')
        except BaseException:
            result = {'type':'code','code':request.get('code','') if isinstance(request,dict) else '',
                      'stdout':'','stderr':'','plots':[],'repr':None,'html':None,'error':traceback.format_exc()[:65536]}
        protocol.write(json.dumps(result,allow_nan=False)+'\n');protocol.flush()


if __name__ == '__main__':
    main()

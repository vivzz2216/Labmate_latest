"""Small local-mode Spark exercises, only inside the OS-isolated Linux worker."""
import asyncio
import base64
import json
import os
from pathlib import Path
import sys
import tempfile
import uuid

from ..config import settings


RUNNER = '''import inspect, os, sys
from pyspark import SparkContext, SparkConf
original = SparkContext.__init__
signature = inspect.signature(original)
def limited_context(self, *args, **kwargs):
    bound = signature.bind_partial(self, *args, **kwargs)
    bound.arguments['master'] = 'local[1]'
    conf = bound.arguments.get('conf') or SparkConf()
    for key, value in {
        'spark.master':'local[1]', 'spark.driver.memory':'512m',
        'spark.executor.memory':'512m', 'spark.driver.host':'127.0.0.1',
        'spark.driver.bindAddress':'127.0.0.1', 'spark.ui.enabled':'false',
        'spark.default.parallelism':'1', 'spark.sql.shuffle.partitions':'1',
        'spark.local.dir':os.path.join(os.getcwd(),'spark-tmp'),
        'spark.sql.warehouse.dir':os.path.join(os.getcwd(),'warehouse'),
        'spark.pyspark.python':sys.executable,
    }.items(): conf.set(key,value)
    bound.arguments['conf'] = conf
    original(*bound.args, **bound.kwargs)
    self.setLogLevel('ERROR')
SparkContext.__init__ = limited_context
try:
    with open(sys.argv[1],encoding='utf-8') as source:
        exec(compile(source.read(),sys.argv[1],'exec'),{'__name__':'__main__'})
finally:
    if SparkContext._active_spark_context is not None:
        SparkContext._active_spark_context.stop()
'''


async def capture_spark(code, datasets=None, output_path=None, **metadata):
    from .isolated_runtime import worker_context
    from .runtime_engine import RuntimeResult, run_process
    from ..security.generated_code import validate_generated_code
    from .colab_pipeline import capture_colab_evidence
    from .lab_capture import notebook_cells
    if not worker_context() or sys.platform != 'linux':
        return RuntimeResult(False, error='PySpark requires the isolated Linux runtime.', exit_code=126)
    cells = notebook_cells(code)
    source = '\n\n'.join(c.get('code', '') for c in cells if c.get('type') == 'code')
    try:
        validate_generated_code(source, 'python', capability='spark')
        with tempfile.TemporaryDirectory(prefix='spark_', dir=settings.REACT_TEMP_DIR) as folder:
            directory = Path(folder)
            for name, content in (datasets or {}).items():
                relative = str(name).replace('\\', '/')
                if relative.startswith('/content/'): relative = relative[len('/content/'):]
                path = directory / relative
                if path.is_absolute() and not path.resolve().is_relative_to(directory.resolve()):
                    raise ValueError('Dataset must stay inside the experiment workspace.')
                if '..' in Path(relative).parts or len(relative) > 512:
                    raise ValueError('Invalid dataset path.')
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content if isinstance(content, bytes) else str(content).encode())
            user_file = directory/'experiment.py'; user_file.write_text(source, encoding='utf-8')
            runner = directory/'run_spark.py'; runner.write_text(RUNNER, encoding='utf-8')
            java = next(iter(sorted(Path('/usr/lib/jvm').glob('java-17-openjdk-*'))), None)
            extras = {'SPARK_LOCAL_IP':'127.0.0.1', 'PYSPARK_PYTHON':sys.executable,
                'PYSPARK_SUBMIT_ARGS':'--driver-memory 512m --driver-java-options "-XX:ActiveProcessorCount=1" pyspark-shell',
                'SPARK_LOCAL_DIRS':str(directory/'spark-tmp')}
            if java: extras['JAVA_HOME'] = str(java)
            result = await run_process([sys.executable, '-I', str(runner), str(user_file)], directory,
                timeout=90, extras=extras, resource_limits={'max_memory_bytes':0,
                    'max_cpu_seconds':90, 'max_procs':160})
            receipt = [{'type':'code','code':source, 'stdout':result.output,
                'error':result.error if not result.success else None, 'execCount':1}]
            target = Path(output_path) if output_path else Path(settings.SCREENSHOT_DIR)/('spark_'+uuid.uuid4().hex+'.png')
            target.parent.mkdir(parents=True,exist_ok=True)
            frames, lines = await asyncio.to_thread(capture_colab_evidence, receipt, str(target),
                source_filename=metadata.get('source_filename','experiment.py'),
                theme=metadata.get('theme','light'), notebook_title=metadata.get('notebook_title') or 'PySpark experiment')
            result.screenshots = {str(i):f['path'] for i,f in enumerate(frames)}
            result.verification = {'kind':'notebook','status':'passed' if result.success else 'failed',
                'runtime':'pyspark-local', 'master':'local[1]', 'source_lines':lines,
                'cells':receipt, 'evidence_frames':frames, 'runtime_stderr':result.error}
            if result.success: result.error = ''
            return result
    except Exception as error:
        return RuntimeResult(False,error='PySpark execution failed: '+str(error),exit_code=1,
            verification={'kind':'notebook','status':'failed'})


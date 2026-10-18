"""Safe compile/headless probes; never opens a desktop window or claims GUI verification."""
import asyncio
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.services.runtime_engine import run_process


async def main():
    cases = {
        'awt': 'import java.awt.*;class Main{public static void main(String[]a){new Frame("Audit");}}',
        'swing': 'import javax.swing.*;class Main{public static void main(String[]a){new JFrame("Audit");}}',
        'javafx': 'import javafx.application.Application;import javafx.stage.Stage;public class Main extends Application{public void start(Stage s){s.show();}}',
    }
    records = []
    for name, code in cases.items():
        with tempfile.TemporaryDirectory(prefix='labmate-gui-audit-') as folder:
            root = Path(folder)
            (root / 'Main.java').write_text(code)
            compile_result = await run_process([settings.JAVAC_COMMAND, 'Main.java'], root, timeout=15,
                                               resource_limits={'max_memory_bytes': 0})
            record = {'framework': name, 'compile_success': compile_result.success, 'compile_error': compile_result.error,
                      'actual_window_capture': False, 'interaction_verified': False}
            if compile_result.success:
                result = await run_process([settings.JAVA_COMMAND, '-Djava.awt.headless=true', 'Main'], root,
                                           resource_limits={'max_memory_bytes': 0})
                record.update(headless_launch_success=result.success, headless_error=result.error)
            records.append(record)
    target = Path('audit_artifacts/gui-dependencies.json')
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(records, indent=2))
    print(json.dumps(records, indent=2))


if __name__ == '__main__': asyncio.run(main())

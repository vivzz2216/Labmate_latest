"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { useAuth } from "@/contexts/BasicAuthContext";
import api from "@/lib/api";
import styles from "./workspace.module.css";

const starter = `def square(number):
    return number * number

number = int(input("Enter a number: "))
print(f"{number} squared is {square(number)}")
`;

interface Result {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
}

export default function PythonIdleWorkspace() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState(starter);
  const [stdin, setStdin] = useState("7");
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!user || running || !code.trim()) return;
    setRunning(true);
    setError("");
    setResult(undefined);
    try {
      const response = await api.post<Result>("/api/ide/python/run", { code, stdin }, { timeout: 90_000 });
      setResult(response.data);
    } catch (failure) {
      const detail = (failure as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Python could not run right now. Try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb"><Link href="/labs">Lab catalogue</Link> / <Link href="/code-execution?lab=python&track=python">Python Code Studio</Link></nav>
      <header className={styles.heading}>
        <div>
          <h1>Python IDLE workspace</h1>
          <p>Write a Python script and read its output in the shell on the same page.</p>
        </div>
        <Link href="/code-execution?track=python">Generate a lab report</Link>
      </header>
      <form className={styles.workspace} onSubmit={run}>
        <section className={styles.panel} aria-labelledby="editor-title">
          <div className={styles.bar}><h2 id="editor-title">IDLE Editor</h2><span>main.py</span></div>
          <label className={styles.hidden} htmlFor="python-code">Python source code</label>
          <textarea className={styles.editor} id="python-code" value={code} onChange={event => setCode(event.target.value)}
            spellCheck={false} maxLength={40_000} />
          <label className={styles.inputLabel} htmlFor="python-stdin">Program input</label>
          <textarea id="python-stdin" className={styles.input} value={stdin} onChange={event => setStdin(event.target.value)}
            placeholder="One answer per line" spellCheck={false} maxLength={8_000} rows={2} />
          <div className={styles.actions}>
            <button type="submit" disabled={!user || running || !code.trim()}><Play size={16} />{running ? "Running…" : "Run script"}</button>
            {!loading && !user && <Link href="/">Sign in to run Python</Link>}
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="shell-title">
          <div className={styles.bar}><h2 id="shell-title">IDLE Shell</h2><span>Script output</span></div>
          <div className={styles.console} role="log" aria-busy={running}>
            {running && <p>Running main.py…</p>}
            {error && <p className={styles.error}>{error}</p>}
            {result && <>
              {result.stdout && <pre>{result.stdout}</pre>}
              {result.stderr && <pre className={styles.error}>{result.stderr}</pre>}
              <p>{result.success ? "Finished" : "Execution failed"}{result.exit_code != null && ` · exit code ${result.exit_code}`}</p>
            </>}
            {!result && !error && !running && <p>Run your script to see the output here.</p>}
          </div>
        </section>
      </form>
    </main>
  );
}

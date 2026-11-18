"use client";

import { useEffect, useState } from "react";

export default function ExecutionStatus() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [resumesAt, setResumesAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch("/health/ready", {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        const result = await response.json();
        if (!cancelled) {
          setAvailable(result.execution_ready === true);
          setResumesAt(typeof result.execution_resumes_at === "string" ? result.execution_resumes_at : null);
        }
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) timer = setTimeout(check, 30000);
      }
    }
    void check();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, []);

  return <p role="status" style={{ color: available === false ? "#fbbf24" : "#94a3b8", fontSize: 13 }}>
    {available === null ? "Checking code execution availability…" : available
      ? "Code execution available"
      : resumesAt
        ? `Code execution has reached its hourly limit. It resumes at ${new Date(resumesAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Completed results are saved; retry then.`
        : "Code execution is temporarily unavailable. Completed results are saved; retry when it recovers."}
  </p>;
}

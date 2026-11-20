"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

export type JavaReportFrame = { filename: string; code: string; output: string; showOutput: boolean };
export type SqlReportFrame = {
  filename: string;
  code: string;
  columns: string[];
  rows: (string | number | null)[][];
  status: string;
  failed: boolean;
  activeLine: number;
  firstLine: number;
};

// Only the report view exposes this hook. It displays data already executed by LabMate.
export function useReportCapture<T>(enabled: boolean, render: (frame: T) => void) {
  const callback = useRef(render);
  callback.current = render;
  useEffect(() => {
    if (!enabled) return;
    const target = window as Window & { __labmateReportFrame?: (frame: T) => void };
    target.__labmateReportFrame = frame => flushSync(() => callback.current(frame));
    return () => { delete target.__labmateReportFrame; };
  }, [enabled]);
}
